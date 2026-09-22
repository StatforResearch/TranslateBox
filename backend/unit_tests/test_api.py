import asyncio
import time
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
import server

TOKEN = 'test-operator-' + 'x' * 32
AUTH = {'Authorization': 'Bearer ' + TOKEN}


@pytest.fixture(autouse=True)
def reset(monkeypatch):
    monkeypatch.setenv('OPERATOR_TOKEN', TOKEN)
    monkeypatch.setenv('OPENAI_API_KEY', 'sk-test-never-real')
    server.EVENTS.clear()
    server.ROOMS.clear()
    server._rate_buckets.clear()


@pytest.fixture
def client():
    with TestClient(server.app) as client:
        yield client


def event(client, **fields):
    response = client.post('/api/events', headers=AUTH, json=fields)
    assert response.status_code == 200, response.text
    return response.json()


def test_operator_required_and_fail_closed(client, monkeypatch):
    for path in ('/api/events', '/api/realtime-session'):
        assert client.post(path, json={}).status_code == 401
    assert client.get('/api/stats').status_code == 401
    assert client.get('/api/operator', headers=AUTH).status_code == 200
    monkeypatch.delenv('OPERATOR_TOKEN')
    assert client.post('/api/events', headers=AUTH, json={}).status_code == 503


def test_health_and_security_headers(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.headers['x-content-type-options'] == 'nosniff'
    assert 'sk-test' not in response.text


def test_body_limit_before_json_validation(client):
    response = client.post('/api/events', content=b'x' * (server.MAX_BODY_BYTES + 1), headers=AUTH)
    assert response.status_code == 413


def test_chunked_body_limit():
    async def run():
        async def chunks():
            yield b'x' * 20000
            yield b'y' * 20000
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as client:
            response = await client.post('/api/events', content=chunks(), headers=AUTH)
            assert response.status_code == 413
    asyncio.run(run())


def test_invalid_language_and_event_fields(client):
    assert client.post('/api/events', json={'target_language': 'xx'}, headers=AUTH).status_code == 400
    assert client.post('/api/events', json={'name': 'x' * 201}, headers=AUTH).status_code == 422
    assert client.post('/api/realtime-session', json={'instructions': 'x' * 6001}, headers=AUTH).status_code == 422


def test_ephemeral_allowlist_and_no_cache(client, monkeypatch):
    mint = AsyncMock(return_value=(httpx.Response(200, json={'value': 'ek_test', 'expires_at': 123, 'unexpected_secret': 'sk-test'}), False))
    monkeypatch.setattr(server, '_mint_session', mint)
    response = client.post('/api/realtime-session', json={'target_language': 'fr'}, headers=AUTH)
    assert response.status_code == 200
    assert response.json()['value'] == 'ek_test'
    assert response.headers['cache-control'] == 'no-store'
    assert 'sk-test' not in response.text
    assert mint.call_args.args[0]['session']['audio']['output']['language'] == 'fr'


@pytest.mark.parametrize('payload', [{'value': 'sk-private'}, {}, []])
def test_invalid_upstream_response(client, monkeypatch, payload):
    monkeypatch.setattr(server, '_mint_session', AsyncMock(return_value=(httpx.Response(200, json=payload), False)))
    assert client.post('/api/realtime-session', json={}, headers=AUTH).status_code == 502


def test_network_error_is_generic(client, monkeypatch):
    monkeypatch.setattr(server, '_mint_session', AsyncMock(side_effect=httpx.ConnectError('sensitive internal host')))
    response = client.post('/api/realtime-session', json={}, headers=AUTH)
    assert response.status_code == 502
    assert 'sensitive' not in response.text


def test_rate_limit_cannot_be_spoofed(client, monkeypatch):
    monkeypatch.setattr(server, '_mint_session', AsyncMock(return_value=(httpx.Response(200, json={'value': 'ek_test'}), False)))
    codes = [client.post('/api/realtime-session', json={}, headers={**AUTH, 'X-Forwarded-For': f'10.0.0.{i}'}).status_code for i in range(21)]
    assert codes == [200] * 20 + [429]


def test_event_secret_not_public_and_ttl(client, monkeypatch):
    ev = event(client, pin='1234')
    response = client.get('/api/events/' + ev['id'])
    assert 'operator_token' not in response.text and '1234' not in response.text
    server.EVENTS[ev['id']]['created'] = time.time() - server.EVENT_TTL - 1
    assert client.get('/api/events/' + ev['id']).status_code == 404
    monkeypatch.setattr(server, 'MAX_EVENTS', 1)
    event(client)
    assert client.post('/api/events', json={}, headers=AUTH).status_code == 429


def test_operator_auth_and_duplicate_connection(client):
    ev = event(client)
    url = f"/api/ws/{ev['id']}?role=operator"
    with client.websocket_connect(url) as ws:
        ws.send_json({'token': 'wrong'})
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 4401
    with client.websocket_connect(url) as op:
        op.send_json({'token': ev['operator_token']})
        assert op.receive_json()['type'] == 'ready'
        assert op.receive_json()['count'] == 0
        with client.websocket_connect(url) as other:
            other.send_json({'token': ev['operator_token']})
            with pytest.raises(WebSocketDisconnect) as error:
                other.receive_json()
            assert error.value.code == 4409
        assert client.get('/api/events/' + ev['id']).json()['live'] is True
    assert client.get('/api/events/' + ev['id']).json()['live'] is False


def test_pin_origin_and_listener_limit(client, monkeypatch):
    ev = event(client, pin='1234')
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url, headers={'origin': 'https://evil.example'}) as ws:
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 4403
    with client.websocket_connect(url) as ws:
        ws.send_json({'pin': 'wrong'})
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 4401
    monkeypatch.setattr(server, 'MAX_LISTENERS', 1)
    with client.websocket_connect(url) as first:
        first.send_json({'pin': '1234'})
        assert first.receive_json()['live'] is False
        with client.websocket_connect(url) as second:
            second.send_json({'pin': '1234'})
            with pytest.raises(WebSocketDisconnect) as error:
                second.receive_json()
            assert error.value.code == 4429


def test_audio_caption_fanout_and_operator_disconnect(client):
    ev = event(client)
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url) as listener:
        listener.send_json({})
        assert listener.receive_json()['live'] is False
        with client.websocket_connect(url + '?role=operator') as op:
            op.send_json({'token': ev['operator_token']})
            assert op.receive_json()['type'] == 'ready'
            assert listener.receive_json()['live'] is True
            op.send_bytes(b'header')
            assert listener.receive_bytes() == b'header'
            with client.websocket_connect(url) as late:
                late.send_json({})
                assert late.receive_json()['live'] is True
                assert late.receive_bytes() == b'header'
                op.send_json({'type': 'caption', 'text': 'Bonjour'})
                assert late.receive_json()['text'] == 'Bonjour'
                assert listener.receive_json()['text'] == 'Bonjour'
        assert listener.receive_json()['live'] is False


def test_catalog_survives_restart_and_rotates_publishing_token(client, monkeypatch, tmp_path):
    from event_store import EventStore
    path = str(tmp_path / 'events.sqlite3')
    first = EventStore(path)
    monkeypatch.setattr(server, 'EVENTS', first)
    ev = event(client, pin='1234', target_language='fr')
    first.close()
    second = EventStore(path)
    monkeypatch.setattr(server, 'EVENTS', second)
    server.ROOMS.clear()
    assert client.get('/api/events/' + ev['id']).json()['target'] == 'fr'
    assert client.get('/api/events').status_code == 401
    listing = client.get('/api/events', headers=AUTH)
    assert listing.json()['events'][0]['id'] == ev['id']
    assert 'operator_token' not in listing.text
    response = client.post(f"/api/events/{ev['id']}/resume", headers=AUTH)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    token = response.json()['operator_token']
    assert token != ev['operator_token']
    assert token not in (tmp_path / 'events.sqlite3').read_bytes().decode('latin1')
    with client.websocket_connect(f"/api/ws/{ev['id']}?role=operator") as ws:
        ws.send_json({'token': ev['operator_token']})
        with pytest.raises(WebSocketDisconnect): ws.receive_json()
    with client.websocket_connect(f"/api/ws/{ev['id']}?role=operator") as ws:
        ws.send_json({'token': token})
        assert ws.receive_json()['type'] == 'ready'
        assert client.post(f"/api/events/{ev['id']}/resume", headers=AUTH).status_code == 409
    assert server._check_pin(ev['id'], '1234') is True
    second.pop(ev['id'])
    second.close()
    third = EventStore(path)
    assert not third
    third.close()


@pytest.mark.parametrize('status,code,expected,message', [
    (401, None, 502, 'key is invalid'), (403, None, 502, 'cannot access'),
    (429, 'insufficient_quota', 402, 'insufficient credit'),
    (429, 'rate_limit_exceeded', 429, 'Wait one minute'), (500, None, 502, 'temporarily unavailable'),
])
def test_actionable_upstream_errors_without_leaking_body(client, monkeypatch, status, code, expected, message):
    response = httpx.Response(status, json={'error': {'code': code, 'message': 'private upstream data sk-secret'}})
    monkeypatch.setattr(server, '_mint_session', AsyncMock(return_value=(response, False)))
    result = client.post('/api/realtime-session', json={}, headers=AUTH)
    assert result.status_code == expected
    assert message in result.json()['detail']
    assert 'sk-secret' not in result.text

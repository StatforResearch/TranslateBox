import React from 'react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Listener from './Listener';
let sockets;
beforeEach(() => {
  sockets = [];
  global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({name: 'Test event', target: 'fr', pin_protected: false, live: true})});
  global.MediaSource = class { static isTypeSupported() { return true; } addEventListener() {} };
  global.WebSocket = class { constructor() { sockets.push(this); } close = vi.fn(); send = vi.fn(); };
  URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
test('reconnects after the first connection drops and stop cancels retry', async () => {
  render(<MemoryRouter initialEntries={['/e/test']}><Routes><Route path="/e/:id" element={<Listener/>}/></Routes></MemoryRouter>);
  await screen.findByText('Test event');
  expect(screen.getByText('Français', {selector: 'span'})).toBeTruthy();
  vi.useFakeTimers();
  fireEvent.click(screen.getByText('LISTEN'));
  expect(sockets.length).toBe(1);
  act(() => sockets[0].onopen());
  expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({type: 'auth', pin: null}));
  act(() => sockets[0].onclose({code: 1006}));
  act(() => vi.advanceTimersByTime(1500));
  expect(sockets.length).toBe(2);
  act(() => sockets[1].onclose({code: 1006}));
  fireEvent.click(screen.getByText('Stop'));
  act(() => vi.advanceTimersByTime(3000));
  expect(sockets.length).toBe(2);
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
test('unsupported audio is explained without opening a socket', async () => {
  MediaSource.isTypeSupported = () => false;
  render(<MemoryRouter initialEntries={['/e/test']}><Routes><Route path="/e/:id" element={<Listener/>}/></Routes></MemoryRouter>);
  await screen.findByText('Test event');
  fireEvent.click(screen.getByText('LISTEN'));
  expect(screen.getByText(/Your browser cannot play/)).toBeTruthy();
  expect(sockets.length).toBe(0);
});

test('buffers on join and never skips words to catch up during playback', async () => {
  let opened, updated;
  let ranges = [[0, .25]];
  const sb = {updating:false, buffered:{get length(){return ranges.length;},start:i=>ranges[i][0],end:i=>ranges[i][1]},addEventListener:(name,fn)=>{if(name==='updateend')updated=fn;},appendBuffer:vi.fn()};
  global.MediaSource = class {static isTypeSupported(){return true;} addEventListener(name,fn){if(name==='sourceopen')opened=fn;} addSourceBuffer(){return sb;}};
  const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
  const {container}=render(<MemoryRouter initialEntries={['/e/test']}><Routes><Route path="/e/:id" element={<Listener/>}/></Routes></MemoryRouter>);
  await screen.findByText('Test event');fireEvent.click(screen.getByText('LISTEN'));
  act(()=>opened());const audio=container.querySelector('audio');
  act(()=>updated());expect(play).not.toHaveBeenCalled();
  ranges=[[0,.25],[20,21.5]];act(()=>updated());
  expect(audio.currentTime).toBe(20.5);expect(play).toHaveBeenCalledTimes(1);
  ranges=[[0,.25],[20,29]];audio.currentTime=22;act(()=>updated());
  expect(audio.currentTime).toBe(22);
  fireEvent.waiting(audio);ranges=[[20,22.5]];act(()=>updated());expect(play).toHaveBeenCalledTimes(1);
  ranges=[[20,23.5]];act(()=>updated());expect(play).toHaveBeenCalledTimes(2);expect(audio.currentTime).toBe(22);
});

test('listener distinguishes buffering, playback and reconnection, and resizes captions without reconnecting', async () => {
  const {container} = render(<MemoryRouter initialEntries={['/e/test']}><Routes><Route path="/e/:id" element={<Listener/>}/></Routes></MemoryRouter>);
  await screen.findByText('Test event');
  fireEvent.click(screen.getByText('LISTEN'));
  act(() => sockets[0].onmessage({data: JSON.stringify({type:'status', live:true})}));
  expect(screen.getByTestId('listener-status').textContent).toContain('Buffering audio');
  fireEvent.playing(container.querySelector('audio'));
  expect(screen.getByTestId('listener-status').textContent).toContain('Translation playing');
  act(() => sockets[0].onmessage({data: JSON.stringify({type:'caption', text:'Bonjour à tous'})}));
  fireEvent.change(screen.getByLabelText('Caption size'), {target:{value:'32'}});
  expect(screen.getByTestId('listener-caption').style.fontSize).toBe('32px');
  expect(sockets.length).toBe(1);
  act(() => sockets[0].onclose({code:1006}));
  expect(screen.getByTestId('listener-status').textContent).toContain('Reconnecting');
});

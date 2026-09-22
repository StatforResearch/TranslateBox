import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useBroadcast } from './useBroadcast';
import { operatorFetch } from '../lib/api';
vi.mock('../lib/api', () => ({operatorFetch: vi.fn(), responseError: async () => 'Resume denied'}));
beforeEach(() => { const values=new Map(); vi.stubGlobal('localStorage', {getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), clear:()=>values.clear()}); });
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const event = {id:'saved', target:'fr', captions:true, listeners:2, operator_token:'renewed'};
function props(active=false) {return {API:'/api', engineRef:{current:{}}, targetLang:'en', profile:{}, start:vi.fn(), stop:vi.fn(), setError:vi.fn(), targetText:'', active, setTargetLang:vi.fn()};}
test('resuming restores language and captions while preserving the event link', async () => {
 operatorFetch.mockImplementation(async (_url, options) => ({ok:true, json:async () => options?.method === 'POST' ? event : {events:[event]}}));
 const options=props(); const {result}=renderHook(() => useBroadcast(options));
 await waitFor(() => expect(result.current.savedEvents).toHaveLength(1));
 await act(async () => {await result.current.resumeEvent('saved');});
 expect(result.current.eventInfo).toEqual(event);
 expect(options.setTargetLang).toHaveBeenCalledWith('fr');
 expect(result.current.captionsToListeners).toBe(true);
 expect(operatorFetch).toHaveBeenCalledWith('/api/events/saved/resume', {method:'POST'});
});
test('cannot replace event during an active translation session', async () => {
 operatorFetch.mockResolvedValue({ok:true,json:async()=>({events:[]})});
 const {result}=renderHook(() => useBroadcast(props(true)));
 await waitFor(() => expect(result.current.catalogLoading).toBe(false));
 await expect(result.current.resumeEvent('saved')).rejects.toThrow('Stop the current session');
 expect(operatorFetch).toHaveBeenCalledTimes(1);
});

#!/usr/bin/env node
// 80.7.1 - the executed half of dev/check-8071.cjs.
//
// Split into its own file because a release carries whole files through the
// API, and one argument over about ten kilobytes is one silent truncation
// away from a broken release. Loaded by check-8071.cjs, never run alone.
const vm = require('node:vm');

module.exports = function runStreamBridge(page, ok, slice) {
  const bridge = slice('  function scStreamSong(){', '  // --- resolution', 'the bridge');
  const deck = slice('  function djTrackById(id){', '  function renderDjTrackStrip(){', 'the deck lookups');
  const sandbox = {
    SC_STREAM_OK: true,
    isFinite, Number, String, Date, Promise, console,
    document: { addEventListener() {} },
    window: { addEventListener() {} },
    activeAudio: () => ({ id: 'deck-element' }),
    scStreamThumb: () => 'https://img.example/loco.jpg',
    scStreamAudio: () => ({ id: 'stream-element' }),
    scStreamState: { curId: 's_abc', audio: { duration: 201, currentTime: 42, paused: false }, blobUrl: '', url: '', mime: '', size: 0, tracks: [] },
    songs: {
      s_abc: { id: 's_abc', videoId: 'abc', title: 'Loco', artist: 'Diljit Dosanjh', dur: 200, lyrics: 'saved words', lyricsSynced: true },
      s_def: { id: 's_def', videoId: 'def', title: 'Ghost', artist: 'Diljit Dosanjh', dur: 180 },
    },
  };
  sandbox.scStreamById = (id) => sandbox.songs[String(id)] || null;
  sandbox.scStreamPhoneOwns = () => true;
  sandbox.allTracks = [{ id: 't1', name: 'A local song' }];
  sandbox.djStreamTrack = null;
  sandbox.scStreamCacheGet = (vid) => (vid === 'abc' ? { url: 'blob:cache-url' } : null);
  let saves = 0;
  sandbox.scStreamSave = () => { saves++; };
  sandbox.dbGet = () => Promise.resolve(null);
  sandbox.dbPut = () => {};
  sandbox.scStreamBarOn = () => {};
  sandbox.scStreamBarSync = () => {};
  sandbox.scStreamSay = () => {};
  sandbox.scStreamRender = () => {};

  vm.createContext(sandbox);
  try {
    vm.runInContext(bridge + '\n' + deck + '\nthis.__song = scStreamSong; this.__listen = scListenAudio; this.__save = scStreamLyricsSave; this.__djById = djTrackById; this.__djUrl = djStreamUrl;', sandbox);
  } catch (e) {
    bad.push('the bridge and the deck lookups run: ' + e.message);
  }

  const song = typeof sandbox.__song === 'function' ? sandbox.__song() : null;
  ok(!!song, 'the streamed song is a track');
  ok(song && song.id === 'scstream:s_abc', 'with an id of its own');
  ok(song && song.name === 'Loco' && song.artist === 'Diljit Dosanjh', 'and the title and artist the bar shows');
  ok(song && song.duration === 201, 'and the length the element reports');
  ok(song && song.artUrl === 'https://img.example/loco.jpg', 'and a cover');
  ok(song && song.stream === true && song.streamId === 's_abc', 'and it knows it is a stream');
  ok(song && song.lyrics === 'saved words' && song.lyricsSynced === true, 'and carries the words already saved for it');

  ok(sandbox.__listen && sandbox.__listen().id === 'stream-element', 'the clock reads the stream while it owns the bar');
  sandbox.scStreamPhoneOwns = () => false;
  ok(sandbox.__listen && sandbox.__listen().id === 'deck-element', 'and the deck when it does not');
  sandbox.scStreamPhoneOwns = () => true;

  const savedOk = sandbox.__save ? sandbox.__save('scstream:s_abc', 'new words', true) : false;
  ok(savedOk === true && saves === 1, 'words found for a stream are written to the stream store');
  ok(sandbox.songs.s_abc.lyrics === 'new words' && sandbox.songs.s_abc.lyricsSynced === true, 'on the song itself');
  ok(sandbox.__save('scstream:nope', 'x', true) === false, 'and an unknown song writes nothing');

  sandbox.djStreamTrack = song;
  ok(sandbox.__djById && sandbox.__djById('scstream:s_abc') === song, 'the deck finds a streamed song by id');
  ok(sandbox.__djById && sandbox.__djById('t1').name === 'A local song', 'and a library song as before');
  ok(sandbox.__djById && sandbox.__djById('nope') === null, 'and nothing for an unknown id');

  sandbox.scStreamState.blobUrl = 'blob:playing-url';
  ok(sandbox.__djUrl && sandbox.__djUrl(song) === 'blob:playing-url', 'the deck decodes the URL the stream is playing');
  sandbox.scStreamState.blobUrl = '';
  sandbox.scStreamState.url = 'https://source.example/audio';
  ok(sandbox.__djUrl && sandbox.__djUrl(song) === 'blob:cache-url', 'then the read-ahead copy');
  sandbox.scStreamCacheGet = () => null;
  ok(sandbox.__djUrl && sandbox.__djUrl(song) === 'https://source.example/audio', 'and the link last');
};

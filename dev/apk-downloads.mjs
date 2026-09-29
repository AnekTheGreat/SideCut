#!/usr/bin/env node
/**
 * How many APKs have been downloaded?
 *
 * The question has one honest answer and one place to look. GitHub counts
 * downloads against RELEASE assets: a workflow artifact (the thing the Android
 * build uploads as SideCut-<version>-<flavor>.apk) is a private build output with
 * no counter attached to it and no API that reports one, and it expires. So
 * .github/workflows/android-build.yml now attaches every APK to a release as
 * well - one tag per flavor, apk-<version>-<flavor> - and this reads those.
 *
 * Studio has the same numbers under APK downloads. This is the terminal version,
 * for the days when the answer is wanted without opening the app.
 *
 *   node dev/apk-downloads.mjs                 # every APK release, with counts
 *   node dev/apk-downloads.mjs --repo o/r      # a different repository
 *
 * `gh` is used when it is available, because it carries the repository credential
 * and therefore works for a PRIVATE repo too. Without it the public API is tried,
 * which only sees public releases.
 */
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const repoArg = argv.indexOf('--repo');
const REPO = repoArg !== -1 ? argv[repoArg + 1] : 'AnekTheGreat/SideCut';

function rowsFrom(releases){
  const rows = [];
  for(const rel of releases || []){
    for(const a of rel.assets || []){
      if(!/\.apk$/i.test(a.name || '')) continue;
      rows.push({ name: a.name, count: a.download_count || 0, tag: rel.tag_name || '', at: a.created_at || rel.published_at || '' });
    }
  }
  return rows;
}

function viaGh(){
  const out = execFileSync('gh', ['api', '--paginate', 'repos/' + REPO + '/releases?per_page=100'], { encoding: 'utf8' });
  // `--paginate` concatenates JSON documents, one per page, which is not valid
  // JSON on its own - so the pages are re-read as a stream rather than parsed.
  return out.split(/\n(?=\[|\{)/).flatMap((chunk) => {
    try { const v = JSON.parse(chunk); return Array.isArray(v) ? v : [v]; } catch(e){ return []; }
  });
}

function viaApi(){
  return fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=100', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SideCut-apk-downloads' }
  }).then((r) => {
    if(!r.ok) throw new Error('GitHub answered ' + r.status + (r.status === 404 ? ' (is the repository public?)' : ''));
    return r.json();
  });
}

async function main(){
  let releases = null, how = '';
  try {
    releases = viaGh();
    how = 'gh api (works for a private repository too)';
  } catch(e){
    try {
      releases = await viaApi();
      how = 'the public GitHub API';
    } catch(e2){
      console.error('Could not read the release list. Tried gh (' + e.message + ') and the API (' + e2.message + ').');
      console.error('If the repository is private, install and log in to the GitHub CLI and run this again.');
      process.exit(1);
    }
  }

  const rows = rowsFrom(releases);
  if(!rows.length){
    console.log('No APK is attached to a release yet in ' + REPO + '.');
    console.log('Push to main (or run the "Build Android (Capacitor) AAB" workflow) and the next build publishes one.');
    return;
  }

  rows.sort((a, b) => b.count - a.count);
  const width = Math.max(...rows.map((r) => r.name.length));
  let total = 0;
  for(const r of rows){
    total += r.count;
    console.log('  ' + r.name.padEnd(width) + '  ' + String(r.count).padStart(5) + ' download' + (r.count === 1 ? '' : 's') + '   ' + r.tag + (r.at ? '  ' + String(r.at).slice(0, 10) : ''));
  }
  console.log('\n' + rows.length + ' APK' + (rows.length === 1 ? '' : 's') + ' published, ' + total + ' download' + (total === 1 ? '' : 's') + ' in total.');
  console.log('Read from ' + REPO + ' via ' + how + '.');
}

main();

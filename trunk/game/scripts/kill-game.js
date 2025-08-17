// node scripts/kill-game-compat.js 28
var redis = require('redis');

// 環境
var host = process.env.REDIS_HOST || '127.0.0.1';
var port = parseInt(process.env.REDIS_PORT || '6379', 10);
var db   = parseInt(process.env.REDIS_DB   || '0', 10);

// 引数
var gameId = process.argv[2];
if (!gameId) {
  console.error('Usage: node scripts/kill-game-compat.js <gameId>');
  process.exit(1);
}

// パターン（必要に応じて追加）
var patterns = [
  '*:' + gameId + '*',
  '*' + gameId + ':*',
  '*game*' + gameId + '*',
  'maf:*' + gameId + '*'
];

// v2/3 互換で作成（本体が古いはずなのでこちらを使う）
var client = redis.createClient(port, host);
client.on('error', function (e) { console.error('Redis error:', e); });

client.on('ready', function () {
  client.select(db, function (err) {
    if (err) { console.error('SELECT error:', err); process.exit(1); }
    scanAndDelPatterns(function (err, total) {
      if (err) { console.error('cleanup error:', err); }
      console.log('Done. Deleted total', total, 'keys for game', gameId);
      client.quit();
    });
  });
});

function scanAndDelPatterns(done) {
  var total = 0, i = 0;
  (function next() {
    if (i >= patterns.length) return done(null, total);
    var pat = patterns[i++];
    scanDelCompat(pat, function (err, n) {
      if (err) return done(err);
      total += n;
      console.log('pattern=', pat, 'deleted=', n);
      next();
    });
  })();
}

// ここがミソ：SCAN が無ければ send_command、さらに最終手段で KEYS
function scanDelCompat(pattern, cb) {
  // try SCAN loop
  if (typeof client.scan === 'function' || typeof client.send_command === 'function') {
    var cursor = '0', deleted = 0;
    (function loop() {
      var doScan = (typeof client.scan === 'function')
        ? function (cursor, pattern, cb) {
            client.scan(cursor, 'MATCH', pattern, 'COUNT', '1000', cb);
          }
        : function (cursor, pattern, cb) { // super-legacy
            client.send_command('SCAN', [cursor, 'MATCH', pattern, 'COUNT', '1000'], cb);
          };

      doScan(cursor, pattern, function (err, res) {
        if (err) return cb(err);
        // node_redis v2: res = [cursor, keys]
        // 一部実装で {cursor, keys} の場合も想定
        var nextCursor, keys;
        if (Array.isArray(res)) {
          nextCursor = res[0];
          keys = res[1] || [];
        } else {
          nextCursor = res.cursor || '0';
          keys = res.keys || [];
        }

        if (keys.length) {
          // v2系: 配列をそのまま渡せる
          client.del(keys, function (err2, n) {
            if (err2) return cb(err2);
            deleted += (n || 0);
            cursor = nextCursor;
            if (cursor === '0') return cb(null, deleted);
            loop();
          });
        } else {
          cursor = nextCursor;
          if (cursor === '0') return cb(null, deleted);
          loop();
        }
      });
    })();
    return;
  }

  // 最終手段：KEYS（本番では非推奨）
  client.keys(pattern, function (err, keys) {
    if (err) return cb(err);
    if (!keys || !keys.length) return cb(null, 0);
    client.del(keys, function (err2, n) {
      if (err2) return cb(err2);
      cb(null, n || 0);
    });
  });
}

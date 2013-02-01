var mineflayer = require('mineflayer')
  , vec3 = mineflayer.vec3
  , navigatePlugin = require('mineflayer-navigate')(mineflayer)
  , argv = require('optimist').argv

var bot = mineflayer.createBot({
  username: argv.username || 'archerbot',
  password: argv.password,
  host: argv.host,
  port: argv.port,
});

var COMFORTABLE_FIRING_RADIUS = 20;
var ANNOUNCE_INTERVAL = 1000 * 60 * 10;

var targetUsername = null;
var lastAnnounceDate = null;
var lastAnnounceMsg = null;

navigatePlugin(bot);

bot.once('spawn', function() {
  setInterval(moveRandomly, 5000);
  setInterval(checkState, 5000);
  checkState();
});

bot.on('chat', function(username, message) {
  if (message === "challenge") {
    challenge(username);
  }
});

bot.on('whisper', function(username) {
  bot.tell(username, "I ignore whisperers.");
});

bot.on('entityGone', function(entity) {
  if (entity.username === targetUsername) {
    bot.chat(targetUsername + ", you coward! You have forfeited the challenge by running away.");
    endChallenge();
  }
});

bot.navigate.on('cannotFind', function() {
  console.info("cannot find path");
});

bot.on('death', function() {
  if (targetUsername) {
    bot.chat(targetUsername + " has bested me.");
    targetUsername = null;
  }
});

function endChallenge() {
  targetUsername = null;
}

function challenge(username) {
  if (targetUsername) {
    bot.tell(username, "I am in the middle of a duel with " + targetUsername + ".");
    return;
  }
  targetUsername = username;
  checkState();
  moveRandomly();
}

function moveTowardSpawn() {
  bot.navigate.to(bot.spawnPoint, {
    endRadius: 50,
    timeout: 3000,
  });
}


function moveRandomly() {
  if (! targetUsername) return moveTowardSpawn();
  var entity = bot.players[targetUsername].entity;
  if (! entity) return moveTowardSpawn();
  // plot a circle around player with a comfortable firing radius.
  // go to a random point on that circle
  var angle = Math.random() * 2 * Math.PI;
  var dx = COMFORTABLE_FIRING_RADIUS * Math.cos(angle);
  var dz = COMFORTABLE_FIRING_RADIUS * Math.sin(angle);
  var dest = vec3(entity.position.x + dx, 255, entity.position.z + dz);
  // move dest down until we hit solid land
  for (; dest.y >= 0; dest.y -= 1) {
    var block = bot.blockAt(dest);
    if (block && block.boundingBox !== 'empty') break;
  }
  bot.navigate.to(dest, {
    endRadius: 2,
    timeout: 2000,
  });
}

function oldAnnouncement() {
  return lastAnnounceDate != null &&
    (new Date() - lastAnnounceDate) <= ANNOUNCE_INTERVAL;
}

function haveEquipment() {
  var haveBow = bot.inventory.count(261) > 0;
  var arrowCount = bot.inventory.count(262);
  return haveBow && arrowCount >= 30;
}

function announce(msg) {
  if (msg === lastAnnounceMsg && oldAnnouncement()) return;
  bot.chat(msg);
  lastAnnounceDate = new Date();
  lastAnnounceMsg = msg;
}

function checkState() {
  if (targetUsername) {
    announce("I am currently dueling " + targetUsername);
  } else if (haveEquipment()) {
    announce("I challenge anyone to a gentlemanly duel. Say 'challenge' to accept.");
  } else {
    announce("I will not accept challenges until I have a bow and at least 30 arrows.");
  }
}

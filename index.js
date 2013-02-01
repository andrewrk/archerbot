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
var MIN_MOVE_INTERVAL = 5000;
var MAX_MOVE_INTERVAL = 10000;
var MIN_SHOOT_INTERVAL = 100;
var MAX_SHOOT_INTERVAL = 6000;

var targetUsername = null;
var targetVelocity = vec3(0, 0, 0);
var lastAnnounceDate = null;
var lastAnnounceMsg = null;
var shootingArrow = false;
var previousPosition = null;
var previousPositionDate = null;

navigatePlugin(bot);

bot.once('spawn', function() {
  setTimeout(moveRandomly, MIN_MOVE_INTERVAL);
  setInterval(checkState, 5000);
  setTimeout(shootArrow, MIN_SHOOT_INTERVAL);
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
    bot.chat("I have defeated " + targetUsername + ".");
    endChallenge();
  }
});

bot.on('entityMoved', function(entity) {
  if (entity.username === targetUsername) {
    var now = new Date();
    if (previousPositionDate != null) {
      var deltaTime = now - previousPositionDate;
      if (deltaTime > 0.000001) {
        targetVelocity = entity.position.minus(previousPosition).scaled(1 / deltaTime);
      }
    }
    previousPositionDate = now;
    previousPosition = entity.position.clone();
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

function shootArrow() {
  if (! targetUsername) return scheduleNext();
  var entity = bot.players[targetUsername].entity;
  if (! entity) return scheduleNext();
  bot.navigate.stop();
  shootingArrow = true;
  bot.activateItem();
  var lookInterval = setInterval(look, 20);
  setTimeout(release, 1500);

  function look() {
    var distance = bot.entity.position.distanceTo(entity.position);
    var heightAdjust = entity.height * 0.8 + (distance * 0.05);
    bot.lookAt(entity.position.offset(0, heightAdjust, 0).plus(targetVelocity.scaled(650)));
  }

  function release() {
    shootingArrow = false;
    clearInterval(lookInterval);
    look();
    bot.deactivateItem();
    moveRandomly();
    scheduleNext();
  }

  function scheduleNext() {
    var nextShootMs = MIN_SHOOT_INTERVAL + Math.random() * (MAX_SHOOT_INTERVAL - MIN_SHOOT_INTERVAL);
    setTimeout(shootArrow, nextShootMs);
  }
}

function moveRandomly() {
  var nextMoveMs = MIN_MOVE_INTERVAL + Math.random() * (MAX_MOVE_INTERVAL - MIN_MOVE_INTERVAL);
  setTimeout(moveRandomly, nextMoveMs);
  if (shootingArrow) return;
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
    endRadius: 10,
    timeout: 2000,
  });
}

function oldAnnouncement() {
  return lastAnnounceDate != null &&
    (new Date() - lastAnnounceDate) <= ANNOUNCE_INTERVAL;
}

function haveEquipment() {
  var bowItem = bot.inventory.findInventoryItem(261);
  if (bowItem) bot.equip(bowItem, 'hand');
  var arrowCount = bot.inventory.count(262);
  return bowItem != null && arrowCount >= 30;
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

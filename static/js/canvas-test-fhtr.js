if(!window.requestAnimationFrame){window.requestAnimationFrame=(function(){return window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(callback,element){window.setTimeout(callback,1000/60);};})();}

function intToColor(i) {
    var r = (i >> 16) & 0xff;
    var g = (i >> 8) & 0xff;
    var b = (i >> 0) & 0xff;
    return 'rgb(' + r + ',' + b + ',' + g + ')';
}

function rainbow(hue) {
    return 'hsl(' + hue + ', 80%, 50%)';
}

function gravity(objects, dt) {
    var minD = 1.5;
    for (var step = 0; step < 3; step++) {
        for (var i = 0; i < objects.length; i++) {
            var o = objects[i];
            for (var j = i + 1; j < objects.length; j++) {
                var k = objects[j];
                var dx = k.x - o.x;
                var dy = k.y - o.y;
                var dz = k.z - o.z;
                var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (d < minD) {
                    var ox = 0.5 - Math.random();
                    var oy = 0.5 - Math.random();
                    var oz = 0.5 - Math.random();
                    var od = Math.sqrt(ox * ox + oy * oy + oz * oz);
                    k.x += minD * ox / od;
                    k.y += minD * oy / od;
                    k.z += minD * oz / od;
                    d = minD;
                }
                var F = (o.mass * k.mass * 0.1) / (0.5 * d * d);
                var Fx = F * dx / d;
                var Fy = F * dy / d;
                var Fz = F * dz / d;
                o.vx += Fx / o.mass * dt;
                o.vy += Fy / o.mass * dt;
                o.vz += Fz / o.mass * dt;
                k.vx += -Fx / k.mass * dt;
                k.vy += -Fy / k.mass * dt;
                k.vz += -Fz / k.mass * dt;
            }
        }
    }
}

function drawRibbon(ctx, o) {
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x - o.vx * 3, o.y - o.vy * 3);
    var dz = 400 / (Math.abs(o.z - -400) + 1);
    var d = o.size + 7 * 6 * Math.sqrt(o.vx * o.vx + o.vy * o.vy);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(o.x, o.y);
    ctx.rotate(Math.atan2(o.vy, o.vx));
    ctx.scale(3 * dz * dz * d / 10, 3 * dz * dz * o.size / 10);
    ctx.drawImage(o.sprite, -0.5, -0.5, 1, 1);
    ctx.restore();
}

function drawObjects(objects, ctx) {
    for (var i = 0; i < objects.length; i++) {
        var o = objects[i];
        drawRibbon(ctx, o);
    }
}

function drawExplosions(explosions, ctx) {
    for (var i = 0; i < explosions.length; i++) {
        var o = explosions[i];
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.arc(o.x, o.y, 20, 0, Math.PI * 2, true);
        ctx.fill();
    }
}

function zsort(a, b) {
    return b.z - a.z;
};

function updateObjects(objects, t, dt, mx, my, explosions, newExplosions, w, h) {
    for (var i = 0; i < objects.length; i++) {
        var o = objects[i];
        if (o.mass == 0) {
            objects.splice(i, 1);
            i--;
            continue;
        }
        var sz = o.size / 2;
        if (o.x < sz && o.vx < 0) {
            o.x = w - sz;
        } else if (o.x > w - sz && o.vx > 0) {
            o.x = sz;
        }
        if (o.y < sz && o.vy < 0) {
            o.y = h - sz;
        } else if (o.y > h - sz && o.vy > 0) {
            o.y = sz;
        }
        if (o.z < -350 - sz && o.vz < 0) {
            o.vz = -o.vz;
        } else if (o.z > 350 - sz && o.vz > 0) {
            o.vz = -o.vz;
        }
        o.vx *= 0.99;
        o.vy *= 0.99;
        o.vz *= 0.99;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.z += o.vz * dt;
        for (var j = 0; j < explosions.length; j++) {
            var e = explosions[j];
            var ex = e.x - o.x;
            var ey = e.y - o.y;
            var de = Math.sqrt(ex * ex + ey * ey);
            if (de < 80) {
                var f = -3;
                o.vx = f * ex / de;
                o.vy = f * ey / de;
            }
        }
    }
}
var newObject = function(a, cx, cy) {
    return {
        x: Math.cos(a) * 100 + cx,
        y: Math.sin(a) * 100 + cy,
        z: Math.random() * 5,
        mass: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 20,
        sendTime: new Date,
        color: rainbow(360 * Math.random())
    };
};
var init = function() {
    var c = document.getElementById('canvas');
    var empty = document.createElement('canvas');
    empty.width = empty.height = 1;
    c.style.cursor = 'url(' + empty.toDataURL() + ')';
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.position = 'absolute';
    c.style.left = c.style.top = '0px';
    var ctx = c.getContext('2d');
    document.body.appendChild(c);
    var objects = [];
    var angleC = -0.5 * Math.PI;
    var explosions = [];
    var newExplosions = [];
    var pt = 0;
    var mx = c.width / 2;
    var my = c.height / 2;
    var t = 0;
    var n = 50;
    var sprites = [];
    for (var j = 0; j < 10; j++) {
        var img = new Image();
        img.src = 'https://smartphone.exposed/static/assets/' + (j % 10) + '.png';
        sprites.push(img);
    }
    var ring = [];
    for (var i = 0; i < n; i++) {
        objects.push(newObject(0, 0, 0));
        ring.push(objects[i]);
        objects[i].x = mx;
        objects[i].y = my;
        objects[i].z = 0;
        objects[i].color = '#00ddff';
        objects[i].sprite = sprites[0];
        objects[i].vx = objects[0].vy = objects[0].vz = 0;
    }
    var tick = function(T) {
        if (objects.length < n) {
            objects.push(newObject(angleC, c.width / 2, c.height / 2));
            objects[objects.length - 1].sprite = sprites[objects.length % sprites.length];
            angleC += 0.01 * 2 * Math.PI;
        }
        t += 16;
        var dt = Math.min(60, (t - pt)) / 8;
        pt = t;
        ctx.fillStyle = 'rgba(255,250,245,0.2)';
        ctx.fillRect(0, 0, c.width, c.height);
        explosions.push.apply(explosions, newExplosions);
        newExplosions.splice(0);
        if (mx > 0) {
            for (var i = 0; i < n; i++) {
                var a = t / 200 + i / n * 2 * Math.PI;
                var o = ring[i];
                var tx = mx + Math.cos(a) * 16;
                var ty = my + Math.sin(a) * 16;
                var dx = tx - o.x;
                var dy = ty - o.y;
                o.x += (tx - o.x) * 0.5;
                o.y += (ty - o.y) * 0.5;
                o.z += (0 - o.z) * 0.5;
            }
        }
        gravity(objects, dt);
        updateObjects(objects, t, dt, mx, my, explosions, newExplosions, c.width, c.height);
        if (mx > 0) {
            for (var i = 0; i < n; i++) {
                var o = ring[i];
                o.vx *= 0.85;
                o.vy *= 0.85;
                o.vz *= 0.85;
            }
        }
        objects.sort(zsort);
        drawObjects(objects, ctx);
        drawExplosions(explosions, ctx);
        explosions.splice(0);
        requestAnimationFrame(tick, c);
    };
    c.addEventListener('mousemove', function(ev) {
        mx = ev.clientX;
        my = ev.clientY;
    }, false);
    c.addEventListener('click', function(ev) {
        newExplosions.push({
            x: ev.clientX,
            y: ev.clientY
        });
        ev.preventDefault();
    }, false);
    c.addEventListener('mouseout', function(ev) {
        mx = -1;
        my = -1;
    }, false);
    requestAnimationFrame(tick, c);
};

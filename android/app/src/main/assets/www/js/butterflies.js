/**
 * ButterLove Animated Canvas & Particle System
 * Fluttering butterflies + floating romantic hearts + interactive love taps
 */

(function () {
  const canvas = document.getElementById('butterflyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Butterfly class
  class Butterfly {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = initial ? Math.random() * width : (Math.random() < 0.5 ? -40 : width + 40);
      this.y = initial ? Math.random() * height : Math.random() * height * 0.8 + 50;
      this.size = Math.random() * 9 + 11; // 11 to 20
      this.speedX = (Math.random() - 0.5) * 1.5 + (this.x < 0 ? 1 : (this.x > width ? -1 : 0));
      this.speedY = (Math.random() - 0.5) * 0.8;
      this.wingAngle = 0;
      this.wingSpeed = 0.15 + Math.random() * 0.15;
      this.colorA = Math.random() < 0.6 ? '#ff3377' : '#ff70a6';
      this.colorB = Math.random() < 0.5 ? '#9d4edd' : '#4cc9f0';
      this.glow = 10 + Math.random() * 10;
      this.alpha = 0.7 + Math.random() * 0.3;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY + Math.sin(this.wingAngle * 0.5) * 0.4;
      this.wingAngle += this.wingSpeed;

      // Wrap or reset
      if (this.x < -60 || this.x > width + 60 || this.y < -60 || this.y > height + 60) {
        this.reset();
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const angle = Math.atan2(this.speedY, this.speedX);
      ctx.rotate(angle);

      // Flap amplitude (0 to 1)
      const flap = Math.abs(Math.sin(this.wingAngle));

      ctx.globalAlpha = this.alpha;
      ctx.shadowBlur = this.glow;
      ctx.shadowColor = this.colorA;

      // Left wing (top & bottom)
      ctx.fillStyle = this.colorA;
      ctx.beginPath();
      ctx.ellipse(-this.size * 0.4 * flap, -this.size * 0.5, this.size * 0.8 * flap, this.size * 0.5, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.colorB;
      ctx.beginPath();
      ctx.ellipse(-this.size * 0.3 * flap, this.size * 0.4, this.size * 0.6 * flap, this.size * 0.4, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Right wing (top & bottom)
      ctx.fillStyle = this.colorA;
      ctx.beginPath();
      ctx.ellipse(this.size * 0.4 * flap, -this.size * 0.5, this.size * 0.8 * flap, this.size * 0.5, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.colorB;
      ctx.beginPath();
      ctx.ellipse(this.size * 0.3 * flap, this.size * 0.4, this.size * 0.6 * flap, this.size * 0.4, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 2, this.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // Floating Heart Particle
  class FloatingHeart {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : height + 20;
      this.size = Math.random() * 8 + 6;
      this.speedY = -(0.4 + Math.random() * 0.6);
      this.driftX = (Math.random() - 0.5) * 0.4;
      this.alpha = 0.2 + Math.random() * 0.4;
      this.color = Math.random() < 0.7 ? '#ff3377' : '#ff70a6';
    }

    update() {
      this.y += this.speedY;
      this.x += this.driftX + Math.sin(this.y * 0.02) * 0.3;
      if (this.y < -30) this.reset();
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;

      const s = this.size / 15;
      ctx.beginPath();
      ctx.moveTo(0, -5 * s);
      ctx.bezierCurveTo(-10 * s, -18 * s, -20 * s, 0, 0, 15 * s);
      ctx.bezierCurveTo(20 * s, 0, 10 * s, -18 * s, 0, -5 * s);
      ctx.fill();
      ctx.restore();
    }
  }

  // Initialize pool
  const butterflies = Array.from({ length: 9 }, () => new Butterfly());
  const hearts = Array.from({ length: 16 }, () => new FloatingHeart());

  function animate() {
    ctx.clearRect(0, 0, width, height);

    hearts.forEach((h) => {
      h.update();
      h.draw(ctx);
    });

    butterflies.forEach((b) => {
      b.update();
      b.draw(ctx);
    });

    requestAnimationFrame(animate);
  }

  animate();

  // Interactive Screen Love Taps
  window.createLoveTap = function (x, y) {
    const emojis = ['💖', '🦋', '💕', '✨', '🌸', '💘', '🤍'];
    for (let i = 0; i < 4; i++) {
      const heart = document.createElement('div');
      heart.className = 'floating-heart';
      heart.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      heart.style.left = `${x}px`;
      heart.style.top = `${y}px`;
      heart.style.fontSize = `${Math.floor(Math.random() * 14 + 18)}px`;

      const tx = (Math.random() - 0.5) * 80;
      const rot = (Math.random() - 0.5) * 60;
      heart.style.setProperty('--tx', `${tx}px`);
      heart.style.setProperty('--rot', `${rot}deg`);

      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 1600);
    }
  };

  document.addEventListener('pointerdown', (e) => {
    // Avoid double triggering if clicking interactive inputs
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      window.createLoveTap(e.clientX, e.clientY);
    }
  });
})();

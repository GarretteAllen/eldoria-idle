/**
 * Hybrid Real Audio & Procedural Sound Engine for Eldoria
 * Supports preloaded authentic 16-bit / retro fantasy OGG audio samples
 * with master & SFX volume control sliders and zero-asset procedural fallback.
 */

type VolumeChangeListener = (master: number, sfx: number, enabled: boolean) => void;

class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public masterVolume: number = 0.35;
  public sfxVolume: number = 0.60;

  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  private listeners: Set<VolumeChangeListener> = new Set();
  private preloaded: boolean = false;

  // Real authentic OGG audio files in public/audio/
  private readonly soundFiles: Record<string, string> = {
    // Skills
    mining: '/audio/mining.ogg',
    mine: '/audio/mining.ogg',
    mine_clink: '/audio/mining.ogg',
    woodcut: '/audio/woodcut.ogg',
    wood_chop: '/audio/woodcut.ogg',
    splash: '/audio/splash.ogg',
    water: '/audio/splash.ogg',
    pour: '/audio/splash.ogg',
    hammer: '/audio/hammer.ogg',
    hammer_strike: '/audio/hammer.ogg',
    anvil: '/audio/hammer.ogg',
    fletch: '/audio/fletch.ogg',
    knife: '/audio/fletch.ogg',
    cook: '/audio/cook.ogg',
    sizzle: '/audio/sizzle.ogg',
    herb: '/audio/herb.ogg',
    snip: '/audio/herb.ogg',
    thieving: '/audio/thieving.ogg',
    pickpocket: '/audio/thieving.ogg',
    alchemy: '/audio/alchemy.ogg',
    potion: '/audio/alchemy.ogg',
    attune: '/audio/attune.ogg',
    chime: '/audio/attune.ogg',
    bell: '/audio/attune.ogg',

    // Combat
    sword_slash: '/audio/sword_slash.ogg',
    slash: '/audio/sword_slash.ogg',
    sword: '/audio/sword_slash.ogg',
    bow_shoot: '/audio/bow_shoot.ogg',
    bow: '/audio/bow_shoot.ogg',
    arrow_hit: '/audio/arrow_hit.ogg',
    magic_cast: '/audio/magic_cast.ogg',
    cast: '/audio/magic_cast.ogg',
    spell: '/audio/magic_cast.ogg',
    hit_impact: '/audio/hit.ogg',
    hit: '/audio/hit.ogg',
    impact: '/audio/hit.ogg',
    hit_splash: '/audio/hit.ogg',
    hurt: '/audio/hurt.ogg',
    monster_hurt: '/audio/hurt.ogg',
    kill: '/audio/kill.ogg',
    monster_death: '/audio/kill.ogg',
    death: '/audio/death.ogg',
    player_death: '/audio/death.ogg',
    eat: '/audio/eat.ogg',
    eat_food: '/audio/eat.ogg',
    heal: '/audio/eat.ogg',

    // Milestones & World
    levelup: '/audio/level_up.ogg',
    level_up: '/audio/level_up.ogg',
    quest: '/audio/quest_complete.ogg',
    quest_complete: '/audio/quest_complete.ogg',
    bounty: '/audio/quest_complete.ogg',
    coin: '/audio/coin.ogg',
    coin_drop: '/audio/coin.ogg',
    loot: '/audio/coin.ogg',
    click: '/audio/click.ogg',
    chest: '/audio/chest.ogg',
    teleport: '/audio/teleport.ogg',
    chat: '/audio/chat.ogg',
  };

  constructor() {
    // Load preferences from localStorage
    if (typeof localStorage !== 'undefined') {
      const savedEnabled = localStorage.getItem('eldoria_sound_enabled');
      if (savedEnabled !== null) this.enabled = savedEnabled === 'true';

      const savedMaster = localStorage.getItem('eldoria_sound_master');
      if (savedMaster !== null) {
        const val = parseFloat(savedMaster);
        if (!isNaN(val)) this.masterVolume = Math.max(0, Math.min(1, val));
      }

      const savedSfx = localStorage.getItem('eldoria_sound_sfx');
      if (savedSfx !== null) {
        const val = parseFloat(savedSfx);
        if (!isNaN(val)) this.sfxVolume = Math.max(0, Math.min(1, val));
      }
    }
  }

  public onVolumeChange(listener: VolumeChangeListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.masterVolume, this.sfxVolume, this.enabled);
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('eldoria_sound_master', this.masterVolume.toString());
    this.notifyListeners();
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('eldoria_sound_sfx', this.sfxVolume.toString());
    this.notifyListeners();
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('eldoria_sound_enabled', this.enabled ? 'true' : 'false');
    this.notifyListeners();
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled) {
      this.play('click');
    }
    return this.enabled;
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Preloads common real sound assets into AudioBuffers asynchronously
   */
  public async preloadCommonSounds() {
    if (this.preloaded) return;
    this.preloaded = true;
    this.initContext();

    const uniqueFiles = Array.from(new Set(Object.values(this.soundFiles)));
    await Promise.allSettled(uniqueFiles.map(file => this.loadSound(file)));
  }

  private async loadSound(url: string): Promise<AudioBuffer | null> {
    if (this.audioBuffers.has(url)) {
      return this.audioBuffers.get(url)!;
    }
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        this.initContext();
        if (!this.ctx) return null;
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.audioBuffers.set(url, audioBuffer);
        return audioBuffer;
      } catch (err) {
        return null;
      }
    })();

    this.loadingPromises.set(url, promise);
    return promise;
  }

  private playBuffer(buffer: AudioBuffer, volumeScale: number = 1.0) {
    if (!this.ctx) return;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const gain = this.ctx.createGain();
      // Master normalization factor (0.35) prevents loud recorded samples from blasting ears
      const finalVolume = Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume * volumeScale * 0.35));
      gain.gain.setValueAtTime(finalVolume, this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(0);
    } catch {
      // Audio playback blocked before gesture
    }
  }

  public async play(name: string, volumeScale: number = 1.0) {
    if (!this.enabled || this.masterVolume <= 0 || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const lowerName = name.toLowerCase().trim();
    const filePath = this.soundFiles[lowerName];

    if (filePath) {
      let buffer = this.audioBuffers.get(filePath);
      if (!buffer) {
        buffer = (await this.loadSound(filePath)) || undefined;
      }
      if (buffer) {
        this.playBuffer(buffer, volumeScale);
        return;
      }
    }

    // Fallback to procedural synth if real sound file not loaded or unavailable
    this.playFallbackSynth(lowerName);
  }

  private get effectiveVolume(): number {
    return Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume * 0.25));
  }

  private playFallbackSynth(name: string) {
    try {
      switch (name) {
        case 'sword_slash':
        case 'slash':
        case 'sword':
          this.playSwordSlash();
          break;
        case 'bow_shoot':
        case 'bow':
          this.playBowShoot();
          break;
        case 'magic_cast':
        case 'cast':
        case 'spell':
          this.playMagicCast();
          break;
        case 'hit_impact':
        case 'hit':
        case 'impact':
          this.playHitImpact();
          break;
        case 'hit_splash':
          this.playHitSplash();
          break;
        case 'eat':
        case 'eat_food':
        case 'heal':
          this.playEatFood();
          break;
        case 'mine':
        case 'mining':
        case 'mine_clink':
          this.playMineClink();
          break;
        case 'woodcut':
        case 'wood_chop':
          this.playWoodChop();
          break;
        case 'hammer':
        case 'hammer_strike':
        case 'anvil':
          this.playHammerStrike();
          break;
        case 'snip':
        case 'herb':
        case 'herb_snip':
          this.playHerbSnip();
          break;
        case 'sizzle':
        case 'cook':
          this.playSizzle();
          break;
        case 'chime':
        case 'arcane':
        case 'attune':
        case 'bell':
          this.playArcaneChime();
          break;
        case 'water':
        case 'pour':
        case 'splash':
          this.playWaterPour();
          break;
        case 'levelup':
        case 'level_up':
        case 'quest':
        case 'quest_complete':
        case 'bounty':
          this.playLevelUp();
          break;
        case 'coin':
        case 'coin_drop':
        case 'loot':
        case 'thieving':
        case 'pickpocket':
          this.playCoinDrop();
          break;
        case 'click':
        default:
          this.playClick();
          break;
      }
    } catch {
      // AudioContext blocked
    }
  }

  private playHammerStrike() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    gain1.gain.setValueAtTime(this.effectiveVolume * 1.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1480, now);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.22);
    gain2.gain.setValueAtTime(this.effectiveVolume * 0.8, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(this.ctx.destination);
    gain2.connect(this.ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.12);
    osc2.stop(now + 0.22);
  }

  private playHerbSnip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.05);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  private playSizzle() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.effectiveVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  private playArcaneChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [659.25, 830.61, 987.77];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const delay = idx * 0.04;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(this.effectiveVolume * 0.6, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.28);
    });
  }

  private playWaterPour() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  private playClick() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.5, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  private playSwordSlash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.12);
    filter.Q.setValueAtTime(2.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.effectiveVolume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  private playBowShoot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  private playMagicCast() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(420, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18);
    osc2.frequency.setValueAtTime(630, now);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);
  }

  private playHitImpact() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gain.gain.setValueAtTime(this.effectiveVolume * 1.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  private playHitSplash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.08);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  private playEatFood() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.setValueAtTime(360, now + 0.05);
    osc.frequency.setValueAtTime(440, now + 0.1);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  private playMineClink() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.07);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  private playWoodChop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  private playCoinDrop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987, now);
    osc.frequency.setValueAtTime(1318, now + 0.06);
    gain.gain.setValueAtTime(this.effectiveVolume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  private playLevelUp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const noteTime = now + idx * 0.09;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(this.effectiveVolume * 0.8, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.28);
    });
  }
}

export const sound = new SoundManager();

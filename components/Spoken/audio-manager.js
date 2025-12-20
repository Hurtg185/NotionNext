export const GlobalAudio = {
  instance: null,
  play(text, onEnd) {
    if (typeof window === 'undefined') return;
    if (this.instance) this.instance.pause();
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyanNeural&r=-0.3`;
    this.instance = new Audio(url);
    this.instance.onended = onEnd;
    this.instance.play().catch(() => {});
  },
  stop() {
    if (this.instance) this.instance.pause();
  }
};

/**
 * @fileoverview Animation Utilities
 * @description Animated feedback for better user experience
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

/**
 * Animation types
 */
export type AnimationType = 'dots' | 'dots2' | 'dots3' | 'line' | 'star' | 'growVertical' | 'growHorizontal';

/**
 * Status animation options
 */
export interface AnimationOptions {
  /** Text to display */
  text: string;
  /** Animation type */
  type?: AnimationType;
  /** Color */
  color?: string;
  /** Auto stop after duration (ms) */
  autoStop?: number;
}

/**
 * Success/Error animation options
 */
export interface ResultAnimationOptions {
  /** Success message */
  successText?: string;
  /** Error message */
  errorText?: string;
  /** Duration before clear (ms) */
  duration?: number;
  /** Show confetti effect */
  confetti?: boolean;
}

/**
 * Animated status indicator
 */
export class AnimatedStatus {
  private spinner: Ora;
  private autoStopTimer?: NodeJS.Timeout;
  
  constructor(options: AnimationOptions) {
    this.spinner = ora({
      text: options.text,
      spinner: options.type || 'dots',
      color: options.color as any || 'cyan'
    });
    
    if (options.autoStop) {
      this.autoStopTimer = setTimeout(() => {
        this.stop();
      }, options.autoStop);
    }
  }
  
  /**
   * Start animation
   */
  start(): AnimatedStatus {
    this.spinner.start();
    return this;
  }
  
  /**
   * Update text
   */
  update(text: string): AnimatedStatus {
    this.spinner.text = text;
    return this;
  }
  
  /**
   * Update with count
   */
  updateWithCount(prefix: string, count: number, suffix: string = ''): AnimatedStatus {
    this.spinner.text = `${prefix} ${chalk.bold.cyan(count.toLocaleString())} ${suffix}`.trim();
    return this;
  }
  
  /**
   * Success completion
   */
  succeed(text?: string): void {
    this.clearAutoStop();
    this.spinner.succeed(text);
  }
  
  /**
   * Error completion
   */
  fail(text?: string): void {
    this.clearAutoStop();
    this.spinner.fail(text);
  }
  
  /**
   * Warning completion
   */
  warn(text?: string): void {
    this.clearAutoStop();
    this.spinner.warn(text);
  }
  
  /**
   * Info completion
   */
  info(text?: string): void {
    this.clearAutoStop();
    this.spinner.info(text);
  }
  
  /**
   * Stop without symbol
   */
  stop(): void {
    this.clearAutoStop();
    this.spinner.stop();
  }
  
  /**
   * Clear auto-stop timer
   */
  private clearAutoStop(): void {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = undefined as any;
    }
  }
}

/**
 * Animated transitions
 */
export class AnimatedTransition {
  /**
   * Fade in effect
   */
  static fadeIn(text: string, duration: number = 1000): Promise<void> {
    return new Promise(resolve => {
      const steps = 10;
      const interval = duration / steps;
      let currentStep = 0;
      
      const colors = [
        'gray',
        'gray',
        'gray',
        'white',
        'white',
        'white',
        'bold'
      ];
      
      const timer = setInterval(() => {
        if (currentStep < colors.length) {
          process.stdout.write('\r' + (chalk as any)[colors[currentStep]](text));
          currentStep++;
        } else {
          clearInterval(timer);
          console.log(); // New line
          resolve();
        }
      }, interval);
    });
  }
  
  /**
   * Type writer effect
   */
  static typeWriter(text: string, speed: number = 50): Promise<void> {
    return new Promise(resolve => {
      let index = 0;
      
      const timer = setInterval(() => {
        if (index < text.length) {
          process.stdout.write(text[index]);
          index++;
        } else {
          clearInterval(timer);
          console.log(); // New line
          resolve();
        }
      }, speed);
    });
  }
  
  /**
   * Progress dots animation
   */
  static async progressDots(text: string, duration: number = 3000): Promise<void> {
    const dots = ['', '.', '..', '...'];
    let index = 0;
    
    const timer = setInterval(() => {
      process.stdout.write(`\r${text}${dots[index % dots.length]}   `);
      index++;
    }, 300);
    
    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(timer);
    process.stdout.write('\r' + ' '.repeat(text.length + 10) + '\r');
  }
}

/**
 * Success animations
 */
export class SuccessAnimation {
  /**
   * Checkmark animation
   */
  static checkmark(message: string): void {
    const frames = [
      '   ',
      '  ✓',
      ' ✓ ',
      '✓  '
    ];
    
    let index = 0;
    const timer = setInterval(() => {
      if (index < frames.length) {
        process.stdout.write(`\r${chalk.green(frames[index])} ${message}`);
        index++;
      } else {
        clearInterval(timer);
        console.log(); // New line
      }
    }, 100);
  }
  
  /**
   * Celebration effect
   */
  static celebrate(message: string): void {
    const emojis = ['🎉', '🎊', '✨', '🌟', '⭐'];
    const colors = ['red', 'yellow', 'green', 'blue', 'magenta'];
    
    console.log('');
    
    // Random confetti
    for (let i = 0; i < 3; i++) {
      let line = '';
      for (let j = 0; j < 50; j++) {
        if (Math.random() > 0.8) {
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          const color = colors[Math.floor(Math.random() * colors.length)];
          line += (chalk as any)[color](emoji);
        } else {
          line += ' ';
        }
      }
      console.log(line);
    }
    
    console.log(chalk.bold.green(`\n        ${message}\n`));
    
    // More confetti
    for (let i = 0; i < 2; i++) {
      let line = '';
      for (let j = 0; j < 50; j++) {
        if (Math.random() > 0.85) {
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          const color = colors[Math.floor(Math.random() * colors.length)];
          line += (chalk as any)[color](emoji);
        } else {
          line += ' ';
        }
      }
      console.log(line);
    }
  }
}

/**
 * Loading animations
 */
export class LoadingAnimation {
  private static activeAnimations = new Set<NodeJS.Timeout>();
  
  /**
   * Wave animation
   */
  static wave(text: string): () => void {
    const chars = text.split('');
    let index = 0;
    
    const timer = setInterval(() => {
      const output = chars.map((char, i) => {
        const offset = (index + i) % chars.length;
        const intensity = Math.sin(offset * 0.3) * 0.5 + 0.5;
        
        if (char === ' ') return char;
        
        if (intensity > 0.7) {
          return chalk.bold.cyan(char);
        } else if (intensity > 0.3) {
          return chalk.cyan(char);
        } else {
          return chalk.dim(char);
        }
      }).join('');
      
      process.stdout.write(`\r${output}`);
      index++;
    }, 100);
    
    this.activeAnimations.add(timer);
    
    return () => {
      clearInterval(timer);
      this.activeAnimations.delete(timer);
      process.stdout.write('\r' + ' '.repeat(text.length) + '\r');
    };
  }
  
  /**
   * Pulse animation
   */
  static pulse(text: string): () => void {
    const colors = ['dim', 'gray', 'white', 'bold', 'white', 'gray'];
    let index = 0;
    
    const timer = setInterval(() => {
      const color = colors[index % colors.length];
      process.stdout.write(`\r${(chalk as any)[color](text)}`);
      index++;
    }, 200);
    
    this.activeAnimations.add(timer);
    
    return () => {
      clearInterval(timer);
      this.activeAnimations.delete(timer);
      process.stdout.write('\r' + ' '.repeat(text.length) + '\r');
    };
  }
  
  /**
   * Clear all animations
   */
  static clearAll(): void {
    this.activeAnimations.forEach(timer => clearInterval(timer));
    this.activeAnimations.clear();
  }
}

/**
 * Progress indicators
 */
export class ProgressIndicators {
  /**
   * Braille spinner
   */
  static braille(): Ora {
    return ora({
      spinner: {
        interval: 80,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      }
    });
  }
  
  /**
   * Custom rocket spinner
   */
  static rocket(): Ora {
    return ora({
      spinner: {
        interval: 100,
        frames: ['🚀    ', ' 🚀   ', '  🚀  ', '   🚀 ', '    🚀']
      }
    });
  }
  
  /**
   * File transfer spinner
   */
  static fileTransfer(): Ora {
    return ora({
      spinner: {
        interval: 150,
        frames: [
          '📁 → 📱',
          '📁 ➜ 📱',
          '📁 ⟹ 📱',
          '📁 ⟾ 📱',
          '📁 ⟿ 📱'
        ]
      }
    });
  }
}

/**
 * Status messages with icons
 */
export class StatusMessage {
  private static readonly icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    debug: '🐛',
    rocket: '🚀',
    folder: '📁',
    file: '📄',
    phone: '📱',
    computer: '💻',
    cloud: '☁️',
    download: '📥',
    upload: '📤',
    sync: '🔄',
    check: '✓',
    cross: '✗',
    arrow: '→'
  };
  
  static success(message: string): string {
    return chalk.green(`${this.icons.success} ${message}`);
  }
  
  static error(message: string): string {
    return chalk.red(`${this.icons.error} ${message}`);
  }
  
  static warning(message: string): string {
    return chalk.yellow(`${this.icons.warning} ${message}`);
  }
  
  static info(message: string): string {
    return chalk.blue(`${this.icons.info} ${message}`);
  }
  
  static debug(message: string): string {
    return chalk.gray(`${this.icons.debug} ${message}`);
  }
  
  static transfer(from: string, to: string): string {
    return `${this.icons.folder} ${from} ${this.icons.arrow} ${this.icons.phone} ${to}`;
  }
}
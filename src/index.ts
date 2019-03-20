import * as webpack from 'webpack';
import * as fs from 'fs';
import * as path from 'path';
import tinify from 'tinify';
import chalk from 'chalk';
import * as crypto from 'crypto';
import { getOptions } from 'loader-utils';

// 判断目录是否存在
function fsExistsSync(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
  } catch {
    return false;
  }
  return true;
}

// 文件大小转换
function fileSize(num: number): string {
  const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let siez = num;
  if (siez === 0 || siez < 0) {
    return ' 0 B';
  }
  if (siez < 1) {
    return `${siez} B`;
  }
  const exponent = Math.min(Math.floor(Math.log(siez) / Math.log(10) / 3), UNITS.length - 1);
  const unit = UNITS[exponent];
  siez = Number((siez / (1000 ** exponent)).toPrecision(3));
  return `${siez} ${unit}`;
}

// Log打印
export interface ILog {
  suc(...action: number[]): void;
  warn(action: string): void;
  err(action: string): void;
}
function Log(fileName: string): ILog {
  const fileNameLog = chalk.blue(`[${fileName}]`);
  const prefix = (icon: string): string => `${icon} tinypng `;
  const sucLog = (...arg: number[]): void => {
    const [before, after] = arg;
    const beforeSize = fileSize(before);
    const afterSize = fileSize(after);
    const ratio = Math.round((before - after) / before * 100) || 0;
    console.log(`${chalk.green(prefix('✔'))}${fileNameLog} ${chalk.yellow(beforeSize)} -> ${chalk.green(afterSize)} (${chalk.cyan(`-${ratio}%`)})`);
  };
  const errorLog = (msg: string): void => {
    console.log(`${chalk.red(prefix('✘'))}${fileNameLog} errorMessage = ${chalk.red(msg)}`);
  };
  const warnLog = (msg: string): void => {
    console.log(`${chalk.yellow(prefix('●'))}${fileNameLog} ${chalk.yellow(msg)}`);
  };

  return {
    suc: sucLog,
    err: errorLog,
    warn: warnLog,
  };
}

// Loader
export interface ILoaderOptions {
  cachePath?: string;
  key?: string;
}
export default function tinypngWebpackLoader(this: webpack.loader.LoaderContext, content: string | Buffer): any {
  let isTimeout = false;

  const fileName = path.relative(this.context, this.resourcePath);
  const beforeFileSize = fs.statSync(this.resourcePath).size;
  const log = Log(fileName);

  if (this.cacheable) {
    this.cacheable();
  }

  const options: ILoaderOptions = getOptions(this) || {};
  const callback = this.async();

  let cachePath = options.cachePath;
  cachePath = path.resolve(cachePath || '.cache/tinify');

  const hashName = crypto.createHash('md5').update(content).digest('hex');
  const hashFile = path.join(cachePath, hashName);

  // 如果有缓存，输出缓存
  if (fs.existsSync(hashFile)) {
    log.warn('from cache...........');
    fs.readFile(hashFile, (_, body) => {
      callback(undefined, body);
    });
    return;
  }

  if (!options.key) {
    log.err('需要key');
    return content;
  }

  // 如果没有缓存目录，创建
  if (!fsExistsSync(cachePath)) {
    cachePath.split('/').reduce(
      (cur: string, next: string): string => {
        const curPath = path.resolve(cur, next);
        try {
          if (curPath !== '/' && !fsExistsSync(curPath)) {
            fs.mkdirSync(curPath);
          }
        } catch (e) {
          const result = (e as Error).message;
          if (result) {
            console.log(result);
          }
        }
        return curPath;
      },
      '/'
    );
  }

  // 超过20秒就timeout，直接返回原图
  const timer = setTimeout(
    () => {
      log.err('timeout');
      isTimeout = true;
      callback(undefined, content);
    },
    15000
  );

  tinify.key = options.key;
  tinify.fromBuffer(content as string).toBuffer((error, resultData: Buffer) => {
    if (isTimeout) {
      return;
    }
    clearTimeout(timer);

    if (error) {
      log.err(error.message);
      callback(undefined, content);
    } else {
      log.suc(beforeFileSize, resultData.length);
      fs.writeFile(
        hashFile,
        resultData,
        err => {
          if (err) {
            console.log('writeFile:', err);
          }
        }
      );
      callback(undefined, resultData);
    }
  });
}

export const raw = true;
export const pitch = function (this: webpack.loader.LoaderContext): any {
  const { resourcePath } = this;
  const canUse = /(\.png|\.jpg)(\?[\w=]+)?$/.test(resourcePath);
  if (!canUse) {
    return fs.readFileSync(resourcePath);
  }
};

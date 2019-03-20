## tinypng-loader

tinypng loader for webpack


## Install

```
$ npm install @funya._./tinypng-loader
```


## Usage

webpack.config.js
```javascript
    ...
    {
        test:  /\.(png|jpg)$/,
        use: [
            {
                loader: 'file-loader',
            },
            {
                loader: '@funya._./tinypng-loader',
                options: {
                    key: "you key from https://tinyjpg.com/developers",
                    cachePath: "cache directory"
                }
            },
        ]
    }
    ...
```
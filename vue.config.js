const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  chainWebpack: config => {
    if (process.env.NODE_ENV === 'production') {
      config.optimization.minimizer('terser').tap((args) => {
        args[0].terserOptions.compress.drop_console = true
        return args
      })
    }
  }
})
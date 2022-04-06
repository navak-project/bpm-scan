module.exports = {
  apps : [{
    name   : "index",
    script: "./index.js",
    env_production : {
        NODE_ENV : "production"
    }
  }],
  deploy : {
    production : {
       "user" : "pi",
       "host" : ["192.168.1.224"],
       "ref"  : "origin/refactor",
      "repo":   "git@github.com:navak-project/bpm-scan.git",
       "path" : "./test",
       "post-deploy" : "git pull && pm2 resart 0"
    }
  }
}

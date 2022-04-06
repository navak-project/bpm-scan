module.exports = {
  apps : [{
    name   : "index",
    script: "./index.js",
    env_production : {
        NODE_ENV : "production"
    },
    env_production : {
      NODE_ENV: "dev"
    }
  }],
  deploy : {
    dev : {
       "user" : "pi",
       "host" : ["192.168.1.224"],
       "ref"  : "origin/dev",
      "repo":   "https://github.com/navak-project/bpm-scan.git",
       "path" : "../bpm-scan-dev",
      "post-deploy": "git pull && npm i && pm2 startOrRestart ecosystem.congif.csj --env dev"
    },
    production : {
       "user" : "pi",
       "host" : ["192.168.1.224"],
       "ref"  : "origin/master",
      "repo":   "https://github.com/navak-project/bpm-scan.git",
       "path" : "../bpm-scan-prod",
      "post-deploy": "git pull && npm i && pm2 startOrRestart ecosystem.congif.csj  --env production"
    }
  }
}

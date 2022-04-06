module.exports = {
  apps : [{
    name   : "station",
    script : "./index.js"
  }],
  deploy : {
    production : {
       "user" : "pi",
       "host" : ["192.168.1.224"],
       "ref"  : "origin/refactor",
      "repo":   "git@github.com:navak-project/bpm-scan.git",
       "path" : "./test",
       "post-deploy" : "npm install"
    }
  }
}

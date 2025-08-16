# Skywell
an atproto-based file sharing service

## Running (production)

### General
The client runs on port 4999 and the server runs on port 5000.
The compiled files are going to go into `/skywell`, and then the `server` and `dist` subdirectories.
If you cannot create these directories, you'll need to update some paths in the nginx config.

#### Requirements
- [nginx](https://www.nginx.com/) for serving the client + server
- [Go](https://go.dev/) for building the server
- [Node.js](https://nodejs.org/) for building the client
- [npm](https://www.npmjs.com/) also for building the client

Setup
```bash
# create relevant directories
$ mkdir /skywell
$ mkdir /skywell/server
$ mkdir /skywell/dist
```

Client
```bash
# cd into directory
$ cd client/skywell

# install dependencies
$ npm install

# build the client
$ npm run build

# copy the built files to the root directory
$ cp -r dist/* /skywell/dist/
```

Server
```bash
# cd into directory
$ cd server

# build server
$ go build . -o skywell -buildvcs=false

# copy the built server to the root directory
$ cp skywell /skywell/server/
```

Making everything run
```bash
# setup nginx
$ cp running/skywell /etc/nginx/sites-available/skywell
$ ln -s /etc/nginx/sites-available/skywell /etc/nginx/sites-enabled/skywell

# restart nginx
$ systemctl restart nginx

# setup systemd service
# this is only for the server, since the client is served from nginx
$ cp running/skywell.service /etc/systemd/system/skywell.service

# reload systemd
$ systemctl daemon-reload

# enable and start the service
$ systemctl enable skywell.service
$ systemctl start skywell.service
```

## Running (development)
Right now the client has the server + the did as hardcoded (PRs open!), so it's going to be more annoying to test your own appview.
If you want make changes to the appview, you're mostly going to want to touch Constants.tsx and Auth.tsx in the client.

Making any changes to the lexicons is a much more involved process. Create an issue if you're interested in that.

### Requirements
- [Go](https://go.dev/) for building the server
- [Node.js](https://nodejs.org/) for building the client
- [npm](https://www.npmjs.com/) also for building the client

Client
```bash
# cd into directory
$ cd client/skywell

# install dependencies
$ npm install

# run the client
$ npm run dev
```

Server
```bash
# cd into directory
$ cd server

# run server (automatically installs dependencies)
$ go run .
```

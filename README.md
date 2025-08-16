# Skywell
an atproto-based file sharing service

## Running (production)

### General
The client runs on port 4999 and the server runs on port 5000.
The compiled files are going to go into `/skywell`, and then the `server` and `dist` subdirectories.
If, for some reason, you cannot make a directory in the root (how are you running nginx?), you'll need to update some paths in the nginx config.

### Client
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

### AppView (aka server)
Requirements:
- Go
```bash
# cd into directory
$ cd server

# run the server
$ go build .
```

### Client
The client runs on port

## Running (development)
Right now the client has the server + the did as hardcoded (PRs open!), so it's going to be more annoying to test your own appview.
If you want make changes to the appview, you're mostly going to want to touch Constants.tsx and Auth.tsx in the client.

If you want to update the lexicon, that's a whole other can of worms. Create an issue if you're interested in that.

### Client
```bash
# cd into directory
$ cd client/skywell

# install dependencies
$ npm install

# run the client
$ npm run dev
```

### AppView (aka server)
```bash
# cd into directory
$ cd server

# run server (automatically installs dependencies)
$ go run .
```

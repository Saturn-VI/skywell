# TODO

## general
- [x] write lexicons (can just use bluesky for most profile details)
  - [x] dev.skywell.file
  - [x] dev.skywell.getActorProfile
  - [x] dev.skywell.getActorFiles (REMOVED)

## server
server doesn't need to do any auth for this usecase because PDS does creation/deletion of records
- [x] scan jetstream
- [x] implement getActorProfile & getActorFiles (REMOVED)
- [x] figure out database
  - go has a built in sql database interface
  - ended up using [gorm](https://gorm.io/) for database access
- [ ] rate limiter
- [ ] translation between slug and atproto uri (uris too long)

## client

### pages
- [ ] home
- [x] upload
- [ ] file
- [ ] profile

### functionality
- [ ] oauth
- [ ] create/delete records
- [ ] upload blobs
- [ ] download files

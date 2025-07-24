# TODO

## general
- [x] write lexicons (can just use bluesky for most profile details)
  - [x] dev.skywell.file
  - [x] dev.skywell.getActorProfile
  - [x] dev.skywell.getActorFiles

## server
server doesn't need to do any auth for this usecase because PDS does creation/deletion of records
- [x] scan jetstream
- [x] implement getActorProfile & getActorFiles
- [ ] authenticate getActorFiles
- [x] figure out database
  - go has a built in sql database interface
  - ended up using [gorm](https://gorm.io/) for database access
- [ ] rate limiter
- [ ] translation between slug and atproto uri (uris too long)

## client

### general
- [ ] make an actually good color theme (catpuccin macchiato? that's boring though)

### pages
- [ ] home
- [x] upload
- [x] file
- [ ] login page
- [ ] profile

### functionality
- [ ] oauth
- [ ] create/delete records
- [ ] upload blobs
- [ ] download files

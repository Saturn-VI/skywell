# TODO

## general
- [x] write lexicons (can just use bluesky for most profile details)
  - [x] dev.skywell.file
  - [x] dev.skywell.getActorProfile
  - [x] dev.skywell.getActorFiles
  - [x] dev.skywell.getUriFromSlug

## server
server doesn't need to do any auth for this usecase because PDS does creation/deletion of records
- [x] scan jetstream
- [x] implement getActorProfile & getActorFiles
- [x] implement getUriFromSlug
- [ ] authenticate getActorFiles
- [x] figure out database
  - go has a built in sql database interface
  - ended up using [gorm](https://gorm.io/) for database access
- [ ] rate limiter
- [x] translation between slug and atproto uri (uris too long)

## client

### general
- [ ] make an actually good color theme (catpuccin macchiato? that's boring though)

### pages
- [ ] home
- [ ] upload
- [x] file
  - [ ] file delete button
- [ ] login page
- [ ] profile

### functionality
- [ ] oauth
- [ ] create/delete records
- [ ] upload blobs
- [ ] download files

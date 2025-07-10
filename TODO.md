# TODO

## general
- [ ] write lexicons (can just use bluesky for most profile details)
  - [ ] dev.skywell.file
  - [ ] dev.skywell.getActorProfile
  - [ ] dev.skywell.getActorFiles

## server
server doesn't need to do any auth for this usecase because PDS does creation/deletion of records
- [ ] scan firehose (jetstream not reliable enough)
- [ ] implement getActorProfile & getActorFiles
- [ ] figure out database
  - go has a built in sql database interface

## client

### pages
- [ ] home
- [ ] upload
- [ ] file
- [ ] profile

### functionality
- [ ] oauth
- [ ] create/delete records
- [ ] upload blobs
- [ ] download files

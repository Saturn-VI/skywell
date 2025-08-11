# TODO

## general
- [x] write lexicons (can just use bluesky for most profile details)
  - [x] dev.skywell.file
  - [x] dev.skywell.getActorProfile
  - [x] dev.skywell.getActorFiles
  - [x] dev.skywell.getFileFromSlug
  - [ ] dev.skywell.indexActorProfile

## server
~~server doesn't need to do any auth for this usecase because PDS does creation/deletion of records~~
- [x] scan jetstream
- [x] implement getActorProfile & getActorFiles
- [x] implement getFileFromSlug
- [x] authenticate getActorFiles
- [x] figure out database
  - go has a built in sql database interface
  - ended up using [gorm](https://gorm.io/) for database access
- [x] rate limiter
- [x] translation between slug and atproto uri (uris too long)

## client

### general
- [ ] make an actually good color theme (catpuccin macchiato? that's boring though)
  - [ ] really just make the site prettier
- [ ] make a logo/icon
- [ ] do mobile testing on every page (once entire thing is done)

### pages
- [ ] home
- [x] upload
- [x] file
  - [x] file delete button
- [x] login page
- [x] profile
  - [ ] make not broken on mobile

### functionality
- [ ] filter handle string for valid characters
- [x] oauth
- [x] create records
- [x] delete records
- [x] upload blobs
- [x] download files
- [ ] refactor entire site to use createResource (https://docs.solidjs.com/reference/basic-reactivity/create-resource)
  - this will be a lot of work
  - do it after 1.0 is released

# plex-poster-optimizer v1.0.1

Ensures Plex Posters are high-quality, e.g. above a minimum height/width threshold.

I found that I wanted to "fix" my Posters after converting from [MyMovies to Plex](https://github.com/nicjansma/mymovies2plex),
as MyMovies had written low-quality (e.g. 510x355 px) DVD box art into a `folder.jpg`, which Plex picked up via
the _Local Media Assets_ instead of a higher-quality source like _The Movie Database_.

As a result, my Plex Posters were a mix of nice, high-res (1000px+) Posters from TMDB and awkward looking low-res DVD box art.

This script scans all of your Plex movies to find Posters underneath the specified threshold, and changes the Poster to other
higher-res options automatically.

## Usage

```
> $ node index.js --help
Options:
  --host       Plex host                                                [string]
  --token      Plex token                                               [string]
  --section    Section titles                                           [string]
  --filter     Title filter                                             [string]
  --pretend    Pretend (don't set status)             [boolean] [default: false]
  --minHeight  Minimum height                                    [default: 1000]
  --minWidth   Minimum width                                      [default: 800]
  --provider   Poster provider[array] [default: "com.plexapp.agents.themoviedb"]
  --max        Maximum number to update                          [default: "-1"]
  --help       Show help                                               [boolean]
  --version    Show version number                                     [boolean]
```

### 1. Getting your Plex Token

To run, you'll need to find your Plex Token.  You can do this by viewing
any title on your Plex, selecting _Get Info_, then _View XML_.  The URL of the
XML file will be something like this:

```
https://plexhost.plex.direct:32400/library/metadata/n?checkFiles=1&includeExtras=1&includeBandwidths=1&X-Plex-Token=abc123
```

Your Plex Token is `abc123` in the above URL.

### 3. Updating Posters

Example:

```
node index.js \
    --host myhost \
    --token abc123 \
    --section Movies \
    --provider com.plexapp.agents.themoviedb \
    --provider com.plexapp.agents.imdb
```

It's recommended to do this in pretend mode first, to see what it would do

```
node index.js ... --pretend
```

## Version History

* 1.0.1 (2019-12-22) - Fixed to work with HTTPS poster URLs
* 1.0.0 (2019-12-19) - Initial version

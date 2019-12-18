# plex-movie-optimizer
TODO

Converts My Movies' Watched/Unwatched status to Plex, and helps you validate
that the Movies and TV Series in My Movies and Plex are in sync.

## Usage

```
> node index.js --help
Options:
  --file        My Movies Collection.xml file name                      [string]
  --host        Plex host                                               [string]
  --token       Plex token                                              [string]
  --section     Section titles                                          [string]
  --pretend     Pretend (don't set status)            [boolean] [default: false]
  --watched     Set Watched movies                    [boolean] [default: false]
  --unwatched   Set Unwatched movies                  [boolean] [default: false]
  --movies      Operate on Movies                               [default: false]
  --tv          Operate on TV shows                             [default: false]
  --series-fix  Series fix JSON file
  --help        Show help                                              [boolean]
  --version     Show version number                                    [boolean]
```

### 1. Getting your Plex Token

To run, you'll need to find your Plex Token.  You can do this by viewing
any title on your Plex, selecting _Get Info_, then _View XML_.  The URL of the
XML file will be something like this:

```
https://plexhost.plex.direct:32400/library/metadata/n?checkFiles=1&includeExtras=1&includeBandwidths=1&X-Plex-Token=abc123
```

Your Plex Token is `abc123` in the above URL.

### 2. Export My Movies to XML

You will also need to export your My Movies database to XML.  You can do this by
opening _My Movies Collection Management_, and going to _File | Export | XML File_.

There, de-select every second-level media-related item (_Covers_, _Posters_, _Backdrops_, etc)
and hit _OK_ to export to an XML file.

### 3. Synchronizing Movies

The example below will synchronize your `Collection.xml` movies to the Plex server
`plexhost` using Plex Token `abc123`.  It will only look at the plex Section called
_Movies_, and will synchronize both Watched and Unwatched status.

```
node index.js --movies --file Collection.xml --host plexhost --token abc123 --section Movies --watched --unwatched
```

It's recommended to do this in pretend mode first, to see if there are any titles
that don't match up:

```
node index.js --movies ... --pretend
```

Matches are done via IMDB Title IDs, so you may need to fix My Movies or Plex
if they don't match.

### 4. Synchronizing TV Series

The example below will synchronize your `Collection.xml` TV series to the Plex server
`plexhost` using Plex Token `abc123`.  It will only look at the plex Section called
_TV_, and will synchronize both Watched and Unwatched status for all series/episodes.

```
node index.js --tv --file Collection.xml --host plexhost --token abc123 --section TV --watched --unwatched
```

It's recommended to do this in pretend mode first, to see if there are any series
that don't match up:

```
node index.js --tv ... --pretend
```

TV Series are matched based on the title.  If a title doesn't match, mymovies2plex
will output an example `series.json` file that you can manually save and
edit the matches for:

```
{
  "Show1": "/library/metadata/n/children",
  "Show2": "/library/metadata/n/children"
}
```

Simply change `n` to the TV series number (which mymovies2plex will also list options)
and re-run with this file specified as `--series-fix`:

```
node index.js --tv ... --series-fix series.json
```

//
// Imports
//
const async = require("async");
const PlexAPI = require("plex-api");
const chalk = require("chalk");
const yargs = require("yargs");
const imgSize = require("image-size");
const url = require("url");
const http = require("http");
const https = require("https");

//
// Command-line args
//
const argv = yargs
    .string("host")
    .describe("host", "Plex host")
    .string("token")
    .describe("token", "Plex token")
    .string("section")
    .describe("section", "Section titles")
    .string("filter")
    .describe("filter", "Title filter")
    .boolean("pretend")
    .describe("pretend", "Pretend (don't set status)")
    .default("pretend", false)
    .describe("minHeight", "Minimum height")
    .default("minHeight", 1000)
    .describe("minWidth", "Minimum width")
    .default("minWidth", 800)
    .array("provider")
    .describe("provider", "Poster provider")
    .default("provider", "com.plexapp.agents.themoviedb")
    .describe("max", "Maximum number to update")
    .default("max", "-1")
    .help()
    .strict()
    .version()
    .argv;

const hostName = argv.host;
const token = argv.token;
const pretend = argv.pretend;
const sectionFilter = argv.section;
const titleFilter = argv.filter;
const minHeight = argv.minHeight;
const minWidth = argv.minWidth;
const provider = argv.provider;
const max = argv.max;

//
// Locals
//
var client = new PlexAPI({
    hostname: hostName,
    token: token
});

//
// Exec
//
async.waterfall([
    //
    // 1. Connect to Plex server
    //
    function(cb) {
        console.log();
        console.log(`Connecting to Plex server at ${hostName}...`);

        client.query("/").then(function(result) {
            console.log(`\tPlex server version ${chalk.green(result.MediaContainer.version)}`);

            cb(null);
        }, function(err) {
            cb(err);
        });
    },

    //
    // 2. Find Sections that contain Movies
    //
    function(cb) {
        console.log("Checking Plex Library...");

        client
            .query("/library/sections")
            .then(results => {
                console.log(`\tFound ${chalk.green(results.MediaContainer.Directory.length)} sections.`);

                // filter to the specified sections
                let filteredSections = results.MediaContainer.Directory;

                if (sectionFilter && sectionFilter.length) {
                    filteredSections = results.MediaContainer.Directory.filter(function(section) {
                        return section && sectionFilter.indexOf(section.title) !== -1;
                    });
                }

                console.log(`\tFiltered to ${chalk.green(filteredSections.length)} sections: ` +
                    filteredSections.map(s => s.title).join(", "));

                return cb(null, filteredSections);
            })
            .catch(cb);
    },

    //
    // 3. Look at all Movies in each Section
    //
    function(filteredSections, cb) {
        let titles = [];

        console.log("Searching for all movies...");

        async.eachSeries(filteredSections, function(section, cbEachSection) {
            console.log(`\t${section.title}:`);

            // find all titles
            let filter = `/library/sections/${section.key}/all`;
            if (titleFilter) {
                filter += `?${titleFilter}`;
            }

            client.query(filter)
                .then(function(titlesFound) {
                    // could not find any matches
                    if (titlesFound.MediaContainer.size === 0) {
                        console.log(chalk.yellow("\t\t✖ no matches"));
                    }

                    console.log(`\t\t${titlesFound.MediaContainer.size} movies`);

                    titles = titles.concat(titlesFound.MediaContainer.Metadata);

                    return cbEachSection();
                });
        },
        function(err) {
            console.log(`\tFound ${titles.length} total movies`);

            cb(err, titles);
        });
    },

    //
    // 4. Look at Posters for each
    //
    function(titles, cb) {
        console.log("Finding posters...");

        var posterData = [];
        var postersToUpdate = [];

        if (max !== -1) {
            titles = titles.slice(0, max);
        }

        async.eachSeries(titles, function(title, cbEachTitle) {
            console.log(`\t${title.title}:`);

            // find all posters
            client.query(`${title.key}/posters`)
                .then(function(metadata) {
                    // could not find any matches
                    if (metadata.MediaContainer.size === 0) {
                        console.log(chalk.yellow("\t\t✖ no posters"));

                        postersToUpdate.push({
                            title: title.title,
                            key: title.key,
                        });

                        return cbEachTitle();
                    }

                    let selectedPoster = metadata.MediaContainer.Metadata.find(function(photo) {
                        return photo.selected;
                    });

                    if (!selectedPoster) {
                        console.log(chalk.yellow("\t\t✖ no selected poster"));

                        postersToUpdate.push({
                            title: title.title,
                            key: title.key,
                            posters: metadata.MediaContainer.Metadata
                        });

                        return cbEachTitle();
                    } else {
                        console.log(chalk.green(`\t\t✔ ${selectedPoster.provider}: ${selectedPoster.key}`));

                        posterData.push({
                            title: title.title,
                            key: title.key,
                            provider: selectedPoster.provider,
                            posterKey: selectedPoster.key,
                            posters: metadata.MediaContainer.Metadata
                        });
                    }

                    return cbEachTitle();
                });
        },
        function(err) {
            cb(err, posterData, postersToUpdate);
        });
    },

    //
    // 5. Look at Poster sizes
    //
    function(posterData, postersToUpdate, cb) {
        console.log(`Looking at ${posterData.length} poster sizes...`);

        async.eachSeries(posterData, function(poster, cbEachPoster) {
            console.log(`\t${poster.title}`);

            client.query(poster.posterKey).then(function(result) {
                let size = imgSize(result);

                if (size.height < minHeight || size.width < minWidth) {
                    console.log(chalk.yellow(`\t\t✖ needs updating: ${size.height} x ${size.width}`));

                    postersToUpdate.push({
                        title: poster.title,
                        key: poster.key,
                        posters: poster.posters
                    });
                } else {
                    console.log(chalk.green(`\t\t✔ ok ${size.height} x ${size.width}`));
                }

                return cbEachPoster();
            });
        },
        function(err) {
            cb(err, postersToUpdate);
        });
    },

    //
    // 6. Find a good update poster
    //
    function(postersToUpdate, cb) {
        console.log(`Finding better ${postersToUpdate.length} posters!`);

        async.eachSeries(postersToUpdate, function(poster, cbEachPoster) {
            let otherPosters = (poster.posters || []).filter(function(filteredPoster) {
                if (Array.isArray(provider)) {
                    return provider.indexOf(filteredPoster.provider) !== -1 &&
                        filteredPoster.key.indexOf("metadata") === -1;
                } else {
                    return filteredPoster.provider === provider &&
                        filteredPoster.key.indexOf("metadata") === -1;
                }
            });

            // if (otherPosters && otherPosters.length > 0) {
            //     if (otherPosters[0].key.indexOf("http") === 0) {
            //         poster.updateTo = otherPosters[0].key;
            //     } else {
            //         poster.updateTo =
            //             decodeURIComponent(otherPosters[0].key.substr(otherPosters[0].key.indexOf("url=") + 4));
            //     }
            // }

            console.log(`\t${poster.title}`);

            if (otherPosters.length === 0) {
                console.log(chalk.yellow(`\t\t✔ no other posters found (${poster.posters.length} before filtering):`));

                return refreshMetadata(poster.key, cbEachPoster);
            }

            async.eachSeries(otherPosters, function(otherPoster, cbEachOtherPoster) {
                if (poster.updateTo) {
                    // already found something
                    return cbEachOtherPoster();
                }

                if (otherPoster.key.indexOf("http") !== 0) {
                    console.log(`\t\t${otherPoster.key}`);

                    client.query(otherPoster.key).then(function(otherPosterResult) {
                        let size = imgSize(otherPosterResult);

                        if (size.height >= minHeight && size.width >= minWidth) {
                            poster.updateTo = otherPoster.key;

                            console.log(chalk.green(`\t\t✔ found ${otherPoster.key} ${size.height} x ${size.width}`));
                        } else {
                            console.log(chalk.yellow(`\t\t✔ skip ${otherPoster.key} ${size.height} x ${size.width}`));
                        }

                        return cbEachOtherPoster();
                    });
                } else {
                    let posterUrl = otherPoster.key;
                    let posterUri = url.parse(posterUrl);
                    let fetchClient = posterUri.protocol === "https:" ? https : http;

                    console.log(`\t\t${posterUrl}`);

                    fetchClient.get(posterUri, function(response) {
                        let chunks = [];

                        response.on("data", function(chunk) {
                            chunks.push(chunk);
                        }).on("end", function() {
                            let buffer = Buffer.concat(chunks);
                            let size = imgSize(buffer);

                            if (size.height >= minHeight && size.width >= minWidth) {
                                poster.updateTo = posterUrl;
                                console.log(chalk.green(`\t\t✔ found ${posterUrl} ${size.height} x ${size.width}`));
                            } else {
                                console.log(chalk.yellow(`\t\t✔ skip ${posterUrl} ${size.height} x ${size.width}`));
                            }

                            return cbEachOtherPoster();
                        });
                    });
                }

                return undefined;
            },
            function(err2) {
                cbEachPoster(err2);
            });

            return undefined;
        },
        function(err) {
            cb(err, postersToUpdate);
        });
    },

    //
    // 7. Update posters!
    //
    function(postersToUpdate, cb) {
        console.log(`Updating ${postersToUpdate.length} posters!`);

        async.eachSeries(postersToUpdate, function(poster, cbEachPoster) {
            console.log(`${poster.title}: ${poster.key}: ${poster.updateTo}`);

            if (pretend) {
                console.log(chalk.yellow("\t\t✖ pretend mode"));

                return cbEachPoster();
            }

            if (!poster.updateTo) {
                console.log(chalk.yellow("\t\t✖ nothing to update to"));

                return cbEachPoster();
            }

            let key = `${poster.key}/poster?url=` + encodeURIComponent(poster.updateTo) +
                "&X-Plex-Product=Plex%20Web&X-Plex-Version=4.8.3&X-Plex-Platform=Chrome" +
                "&X-Plex-Client-Identifier=f8fuynsk07tfit52fht555k1" +
                "&X-Plex-Platform-Version=77.0&X-Plex-Sync-Version=2&X-Plex-Features=external-media" +
                "&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome" +
                "&X-Plex-Device-Screen-Resolution=1920x1097%2C1920x1200&X-Plex-Language=en";

            // console.log(`\t${key}`);

            client.putQuery(key).then(function(result) {
                console.log(result);

                // Force a metadata refresh -- otherwise somehow the Posters/Artwork sometimes get lost
                refreshMetadata(poster.key, cbEachPoster);
            });

            return undefined;
        },
        function(err) {
            cb(err, postersToUpdate);
        });
    }
],
function(err) {
    if (err) {
        console.error(err);
    }
});

function refreshMetadata(key, callback) {
    let refreshKey = `${key}/refresh`;
    console.log(`\trefreshing metadata: ${refreshKey}`);

    client.putQuery(refreshKey).then(function(result) {
        return callback && callback(null, result);
    });
}

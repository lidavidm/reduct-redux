#!/bin/bash

set -e

# https://stackoverflow.com/a/34676160
# the temp directory used, within $DIR
# omit the -p parameter to create a temporal directory in the default location
WORK_DIR=$(mktemp -d -p "$(pwd)")

# check if tmp dir was created
if [[ ! "$WORK_DIR" || ! -d "$WORK_DIR" ]]; then
  echo "Could not create temp dir"
  exit 1
fi

# deletes the temp directory
function cleanup {
  rm -rf "$WORK_DIR"
  echo "Deleted temp working directory $WORK_DIR"
}

# register the cleanup function to be called on the EXIT signal
trap cleanup EXIT

## Start of script

xlsx2csv $1 -i -s 0 | python splitcsv.py ${WORK_DIR}

for filepath in ${WORK_DIR}/*.csv; do
    filename=$(basename ${filepath})
    echo Importing ${filename%.*}
    python chapterutil.py ${filepath} ../resources/levels-progression/${filename%.*}.json
done

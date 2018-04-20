#!/bin/sh

set -e

if [[ -f title-assets.png ]]; then
    rm title-assets.png
fi

if [[ -d ./png/ ]]; then
    rm -rf ./png/
fi

mkdir ./png/

for filepath in ./svg/*.svg; do
    filename=$(basename ${filepath})
    echo Converting ${filename}
    convert -trim -background none -antialias -density 300 ${filepath} ./png/${filename%.*}.png
done

# Add drop shadow
for filepath in ./png/food_*.png; do
    # Add 5px empty space to bottom; then convert to all black; lastly composite iamge
    convert $filepath \( \
            +clone -gravity south -background none -splice 0x5 \
            -alpha extract -threshold 0 -negate -transparent white -page +0+5 -background none -flatten \
            \) \
            +swap -background none -layers merge +repage $filepath
done

$(npm root)/.bin/spritesheet-js --padding 2 -f json -n title-assets png/*.png

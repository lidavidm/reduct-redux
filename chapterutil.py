#!/usr/bin/env python3
"""
CLI utility to convert between level JSON and chapter CSV.
"""

import argparse
import ast
import json
import csv
import os
import sys


fieldnames = {
    "board": ast.literal_eval,
    "goal": ast.literal_eval,
    "textgoal": str,
    "toolbox": ast.literal_eval,
    "defines": lambda x: ast.literal_eval(x) if x else None,
    "globals": ast.literal_eval,
    "syntax": ast.literal_eval,
    "animationScales": ast.literal_eval,
    "fade": ast.literal_eval,
}
singleton_fields = {"textgoal", "globals", "animationScales"}
field_defaults = {
    "animationScales": {},
    "globals": {},
    "syntax": [],
    "fade": {},
    "board": [],
}


def json2csv(infile, outfile):
    levels = []

    with open(infile) as inf:
        chapter = json.load(inf)
        # TODO: need to handle macros
        for lvl in chapter["levels"]:
            row = {}
            for key in fieldnames:
                if key not in lvl:
                    row[key] = field_defaults.get(key, "")
                elif key not in singleton_fields and not isinstance(lvl[key], list):
                    row[key] = [lvl[key]]
                else:
                    row[key] = lvl[key]
            levels.append(row)

    with open(outfile, "w") as ouf:
        writer = csv.DictWriter(ouf, fieldnames=fieldnames)
        writer.writeheader()
        for lvl in levels:
            writer.writerow(lvl)


def csv2json(infile, outfile):
    with open(outfile) as outf:
        chapter = json.load(outf)

    levels = []
    with open(infile) as inf:
        reader = csv.DictReader(inf)
        for lvl in reader:
            level = {}
            for field, converter in fieldnames.items():
                if field not in lvl:
                    continue

                val = converter(lvl[field])
                if val and isinstance(val, list) and len(val) == 1 and not val[0]:
                    pass
                elif val:
                    level[field] = val
                elif field in field_defaults:
                    level[field] = field_defaults[field]
            levels.append(level)

    chapter["levels"] = levels
    with open(outfile, "w") as outf:
        json.dump(chapter, outf, indent=4)


def main():
    parser = argparse.ArgumentParser(description="Turn a JSON file into CSV, or take a CSV file and a JSON file and replace the JSON file's levels with the CSV file's.")
    parser.add_argument("input", help="A JSON chapter to convert to CSV, or a CSV to convert to JSON.")
    parser.add_argument("output", help="A CSV file to overwrite, or a JSON file whose levels should be replaced.")

    args = parser.parse_args()

    if os.path.splitext(args.input)[1].lower() == ".json":
        json2csv(args.input, args.output)
    elif os.path.splitext(args.input)[1].lower() == ".csv":
        csv2json(args.input, args.output)
    else:
        print("Input file must either be .json or .csv.")
        sys.exit(1)


if __name__ == "__main__":
    main()

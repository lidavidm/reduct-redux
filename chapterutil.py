#!/usr/bin/env python3
"""
CLI utility to convert between level JSON and chapter CSV.
"""

import argparse
import json
import csv
import os
import sys


fieldnames = ["board", "goal", "textgoal", "toolbox", "defines", "globals"]
singleton_fields = {"textgoal", "globals"}


def json2csv(infile, outfile):
    levels = []

    with open(infile) as inf:
        chapter = json.load(inf)
        # TODO: need to handle macros
        for lvl in chapter["levels"]:
            row = {}
            for key in fieldnames:
                if key not in lvl:
                    row[key] = ""
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
    pass


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

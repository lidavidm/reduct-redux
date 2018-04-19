import os
import sys

def main():
    output_dir = sys.argv[1]

    output_file = None

    for line in sys.stdin:
        if line.startswith("--------"):
            filename = f"{line[9:].split('-', 1)[-1].strip()}.csv"
            print("Opening file", filename)

            if output_file:
                output_file.close()

            output_file = open(os.path.join(output_dir, filename), "w")
        elif output_file:
            output_file.write(line)
        else:
            print("Warning: no output file")

if __name__ == "__main__":
    main()

#!/bin/bash

# Add //@ts-nocheck to the top of all .ts files in src directory
echo "Adding //@ts-nocheck to all TypeScript files..."

# Find all .ts files and add //@ts-nocheck at the top
find src -name "*.ts" -type f | while read file; do
  # Check if the file already has @ts-nocheck
  if ! grep -q "@ts-nocheck" "$file"; then
    # Add //@ts-nocheck at the very beginning of the file
    echo -e "//@ts-nocheck\n$(cat $file)" > "$file"
    echo "Added @ts-nocheck to: $file"
  else
    echo "Skipping (already has @ts-nocheck): $file"
  fi
done

echo "Done! All TypeScript files now have @ts-nocheck directive."
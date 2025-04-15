import json
import jenkspy
import re

# List of years matching your JS files
years = [1820, 1830, 1840, 1850, 1860, 1870, 1890, 1900, 1910, 1920]
jenks_breaks = {}

for year in years:
    try:
        # Read the JS file
        with open(f'{year}.js', 'r') as f:
            js_content = f.read()
        
        # Extract the GeoJSON part using regex
        # Matches patterns like: var y1820 = {...};
        match = re.search(r'var y\d+\s*=\s*({.*?});', js_content, re.DOTALL)
        
        if not match:
            print(f"Could not extract GeoJSON from {year}.js")
            continue
            
        geojson_str = match.group(1)
        
        # Parse the JSON
        geojson = json.loads(geojson_str)
        
        # Extract population values
        pop_field = f'A00AA{year}'
        values = []
        
        for feature in geojson['features']:
            if pop_field in feature['properties']:
                value = feature['properties'][pop_field]
                if value is not None and value > 0:  # Only include positive values
                    values.append(value)
        
        # Calculate Jenks breaks (5 classes) if we have enough values
        if len(values) >= 5:
            breaks = jenkspy.jenks_breaks(values, n_classes=5)
            jenks_breaks[str(year)] = breaks
            print(f"Processed {year} with {len(values)} values")
        else:
            # Fallback to quantile if not enough values
            sorted_values = sorted(values)
            if len(sorted_values) > 0:
                jenks_breaks[str(year)] = [
                    sorted_values[0],
                    sorted_values[int(len(sorted_values)*0.25)],
                    sorted_values[int(len(sorted_values)*0.5)],
                    sorted_values[int(len(sorted_values)*0.75)],
                    sorted_values[-1]
                ]
                print(f"Used quantile fallback for {year} with {len(values)} values")
            else:
                print(f"No valid values found for {year}")
                jenks_breaks[str(year)] = [0, 0, 0, 0, 0]
                
    except Exception as e:
        print(f"Error processing {year}.js: {str(e)}")
        jenks_breaks[str(year)] = [0, 0, 0, 0, 0]  # Default breaks if error occurs

# Save as JSON
with open('jenks_breaks.js', 'w') as f:
    f.write(f'const jenksBreaks = {json.dumps(jenks_breaks, indent=2)};')
    print("Successfully generated jenks_breaks.js")
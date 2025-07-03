import json

# Read package.json
with open('package.json', 'r') as f:
    package = json.load(f)

# Ensure dependencies section exists
if 'dependencies' not in package:
    package['dependencies'] = {}

# Add missing dependencies commonly needed
missing_deps = {
    'connect-mongo': '^4.6.0',
    'express': '^4.18.2', 
    'express-session': '^1.17.3',
    'mongoose': '^7.5.0',
    'socket.io': '^4.7.2',
    'express-fileupload': '^1.4.0',
    'winston': '^3.10.0',
    'dotenv': '^16.3.1'
}

# Add them
for dep, version in missing_deps.items():
    if dep not in package['dependencies']:
        package['dependencies'][dep] = version
        print(f'Added {dep}: {version}')

# Write back
with open('package.json', 'w') as f:
    json.dump(package, f, indent=2)

print('Dependencies updated!')

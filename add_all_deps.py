import json

with open('package.json', 'r') as f:
    package = json.load(f)

# Comprehensive list of dependencies likely needed
all_deps = {
    'handlebars': '^4.7.8',
    '@sentry/node': '^7.77.0',
    'express-fileupload': '^1.4.0',
    'swagger-jsdoc': '^6.2.8',
    'swagger-ui-express': '^5.0.0',
    'node-cron': '^3.0.2',
    'express-validator': '^7.0.1',
    'cookie-parser': '^1.4.6',
    'express-ejs-layouts': '^2.5.1',
    'method-override': '^3.0.0',
    'moment': '^2.29.4',
    'uuid': '^9.0.1',
    'axios': '^1.6.0',
    'lodash': '^4.17.21',
    'async': '^3.2.4'
}

added_count = 0
for dep, version in all_deps.items():
    if dep not in package['dependencies']:
        package['dependencies'][dep] = version
        print(f'Added {dep}: {version}')
        added_count += 1

if added_count > 0:
    with open('package.json', 'w') as f:
        json.dump(package, f, indent=2)
    print(f'\\nAdded {added_count} dependencies!')
else:
    print('No new dependencies to add.')

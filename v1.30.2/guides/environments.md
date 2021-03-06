# Environments

This guide shows you how to create production, staging, and other environments.

## Overview

In order to serve your site on a specific domain, you need to configure an environment. Most sites have at least three environments: default, staging, and production. Free accounts are limited to the a single environment (default). Paid accounts allow you to create as many environments as you need. Each environment consists of:

- **Domains** - one or more domains on which the site will be served. Domains cannot be set on the default environment. The domain name for the default environment is derived from your team and site's name.
- **Environment Variables** - secrets and other values that are specific to the environment and are not appropriate to check into source control. For example, API keys are commonly stored as environment variables
- **Split Testing** - Split traffic between multiple router destinations or other environments to conduct A/B testing or implement blue/green deployments.
- **Caching** - Each environment has a separate cache space that is automatically cleared each time you deploy. Use the *Caching* tab to clear the cache by path or surrogate key.

## Creating an Environment

To create an environment, navigate to your site and select the *Environments* tab, and click *New Environment*:

![environments](/images/environments/environments.png)

## Deploying to an Environment

To deploy to an environment, you can `xdn deploy` with the `--environment` option:

```bash
xdn deploy <team name> --environment=<environment name>
```

You can also promote any existing deployment to an environment using the *Promote to Environment* button at the top of the deployment view:

![promote](/images/environments/promote.png)

When configuring CI, we recommend:

- Automatically deploying to your staging environment when a PR is merged to the master branch of your repo.
- Manually promoting deployments to production using the Moovweb Console to prevent unwanted builds from being published by misconfigured CI workflows.

## Environment Versions

Since environments contain important settings that affect how your site functions, they are versioned. This makes it easy to roll back to a previous version of the environment if you make a change that breaks the site. To change your environment settings, create a new draft version by clicking the *Edit* button:

![edit](/images/environments/edit.png)

As you make changes they are saved in the draft version. Once your ready to deploy your changes, click *Activate*.

![activate](/images/environments/activate.png)

Doing so will redeploy the environment's active deployment updated with the new environment configuration.

## Environment Variables

The variables you configure on an environment can be accessed in your code using `process.env`.  A common use case is to configure
different backend host names in `xdn.config.js` based on the environment.  Here is an example where the origin backend is determined 
by a `HOST` environment variable.  

```js
// xdn.config.js
const defaultHostname = 'origin.my-site.com'

module.exports = {
  backends: {
    origin: {
      domainOrIp: process.env.HOST || defaultHostname, // Falling back to defaultHostname is needed during the initial 
      hostHeader: process.env.HOST || defaultHostname, // deployment of your site, when an environment is not yet configured.
    },
  },
}
```

Note that your `xdn.config.js` file is loaded during deployment to configure the edge for your environment.  The first time you 
deploy your site, there won't be any environment variables defined, so you need to include defaults in `xdn.config.js` as
shown in the example above.

## dotenv

To configure secrets during local development, we recommend using [dotenv](https://github.com/motdotla/dotenv). 
If you would like to reference environment variables read from `.env` in `xdn.config.js`, add the following at the top
of `xdn.config.js`

```js
// xdn.config.js
require('dotenv').config()
```
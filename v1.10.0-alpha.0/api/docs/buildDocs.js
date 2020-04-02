#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const moduleParser = require('./moduleParser').default
const globby = require('globby')

const MODULES_PATH = path.join(__dirname, '../packages/core/src')
const MODULES_DOC_FILEPATH = path.join(__dirname, 'build/modules.json')

function getComponentName(filepath) {
  let name = path.basename(filepath)
  let ext
  while ((ext = path.extname(name))) {
    name = name.substring(0, name.length - ext.length)
  }
  return name
}

function readFileContent(file) {
  const filepath = path.resolve(MODULES_PATH, file)
  const src = fs.readFileSync(filepath, 'utf8')
  const filename = getComponentName(filepath)
  return {
    id: filename,
    name: filename,
    filepath,
    filename,
    importPath: path.join(path.dirname(file), path.basename(file, '.js')),
    src,
  }
}

async function maybeParseModule(module) {
  try {
    if (module.filename !== 'index') {
      const result = await moduleParser(module.filepath, module.importPath)
      return Object.keys(result.exports).length === 0
        ? undefined
        : Object.assign({}, module, result, { component: false })
    }

    return undefined
  } catch (e) {
    console.error('Unable to generate docs for ' + module.filename, e)
    return undefined
  }
}

function isComponentParsed(x) {
  return !!x
}

const main = async () => {
  console.log('\x1b[36m%s\x1b[0m', 'Building component docs...')
  const data = (
    await Promise.all(
      globby
        .sync(['**/*.{js,ts}'], { cwd: MODULES_PATH })
        .map(readFileContent)
        .map(maybeParseModule)
    )
  ).filter(isComponentParsed)

  const addMenu = (result, isRootFile, root, menuItem) => {
    if (isRootFile) {
      result.menu[root] = menuItem

      return result
    }

    // Handle folders
    if (result.menu[root]) {
      result.menu[root].items.push(menuItem)
    } else {
      result.menu[root] = { items: [menuItem], text: root }
    }
  }

  const modulesData = data
    .filter(item => !item.component)
    .reduce(
      (result, componentObject) => {
        const { importPath, exports, item } = { ...componentObject }
        const root = importPath.split('/')[0]
        const isRootFile = root === importPath

        result.exports = Object.assign({}, result.exports, exports)
        addMenu(result, isRootFile, root, item)

        return result
      },
      { menu: {}, exports: {} }
    )

  const sortByText = (a, b) =>
    (a.text || '').toLowerCase().localeCompare((b.text || '').toLowerCase())
  const sortItems = items => {
    items = items.sort((a, b) => sortByText(a, b))
    items = items.map(item => {
      if (item && item.items) {
        item.items = sortItems(item.items)
      }

      return item
    })

    return items
  }

  modulesData.menu = sortItems(Object.values(modulesData.menu))
  Object.keys(modulesData.exports).map(key => {
    if (modulesData.exports[key].members) {
      modulesData.exports[key].members = modulesData.exports[key].members.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      )
    }
  })

  saveJsFile(modulesData, MODULES_DOC_FILEPATH)
}

main()

function saveJsFile(data, filepath) {
  const json = JSON.stringify(data)
  fs.writeFileSync(filepath, json, 'utf8')
}

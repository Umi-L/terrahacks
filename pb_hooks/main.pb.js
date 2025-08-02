routerAdd("GET", "/hello/", (e) => {
    const cmd = $os.cmd('ls', '-sl')

    return e.json(200, { "message": toString(cmd.output()) })
})

routerAdd("GET", "/hello/", (e) => {
    const cmd = $os.cmd('ls', '-sl')

    return e.json(200, { "message": toString(cmd.output()) })
})

routerAdd("POST", "/physical-model/", (e) => {
    const data = e.requestInfo().body;
    const symptoms = data.symptoms;

    if (!Array.isArray(symptoms)) {
        return e.json(400, { "error": "Invalid symptoms data" });
    }

    // Run the Python script with the symptoms as input
    const cmd = $os.cmd(
        '/home/julian/terrahacks/medical-mole-ml-model/bin/python',
        '/home/julian/terrahacks/medical-mole-ml-model/predictor.py',
        ...symptoms
    );

    // Parse the output from the Python script
    const output = cmd.output();
    return e.json(200, { "message": "Physical model processed", "result": output });
});

routerAdd("POST", "/mental-model/", (e) => {
    const data = e.requestInfo().body;
    const symptoms = data.symptoms;
    const age = data.age;
    const gender = data.gender;

    if (!Array.isArray(symptoms)) {
        return e.json(400, { "error": "Invalid symptoms data" });
    }

    // Run the Python script with the symptoms as input
    const cmd = $os.cmd(
        '/home/julian/terrahacks/MentalHealthMLM/src/bin/python',
        '/home/julian/terrahacks/MentalHealthMLM/src/quick_diagnosis.py',
        "--age", age.toString(),
        "--gender", gender,
        "--symptoms", symptoms.join(",")
    );

    // Parse the output from the Python script
    const output = cmd.output();
    return e.json(200, { "message": "Mental model processed", "result": output });
});

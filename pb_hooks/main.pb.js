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
    const data = e.json();
    const { symptoms, age, gender } = data;

    if (!Array.isArray(symptoms) || typeof age !== 'number' || typeof gender !== 'string') {
        return e.json(400, { "error": "Invalid data" });
    }

    // Process the symptoms, age, and gender for the mental model
    return e.json(200, { "message": "Mental model processed", "symptoms": symptoms, "age": age, "gender": gender });
});

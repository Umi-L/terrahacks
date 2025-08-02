routerAdd("GET", "/hello/", (e) => {
    const cmd = $os.cmd('ls', '-sl')

    return e.json(200, { "message": toString(cmd.output()) })
})

routerAdd("POST", "/physical-model/", (e) => {
    const data = e.json();
    const symptoms = data.symptoms;

    if (!Array.isArray(symptoms)) {
        return e.json(400, { "error": "Invalid symptoms data" });
    }

    // Prepare the symptoms as a space-separated string
    const symptomsInput = symptoms.join(' ');

    // Run the Python script with the symptoms as input
    const cmd = $os.cmd(
        '~/terrahacks/medical-mole-ml-model/bin/python',
        '~/terrahacks/medical-mole-ml-model/predictor.py',
        symptomsInput
    );

    if (cmd.exitCode() !== 0) {
        return e.json(500, { "error": "Failed to process physical model" });
    }

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

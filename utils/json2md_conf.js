const json2md = require("json2md")

json2md.converters.id = function (input) {
    return `ID: ${input}`;
};

json2md.converters.lead_in = function (input) {
    return `## Lead In\n\n${input}`;
};

json2md.converters.illustration = function (input) {
    let output = '## Illustration\n\n';
    input.forEach(item => {
        output += `* ${item.string}\n  Video Link\n`;
    });
    return output;
};

json2md.converters.explanation = function (input) {
    return `## Explanation\n\n${input}`;
};

json2md.converters.learning_objectives = function (input) {
    return `## Learning Objectives\n\n${input}`;
};

json2md.converters.controlled_practice = function (input) {
    return `## Controlled Practice\n\n${input}`;
};

json2md.converters.extended_practice = function (input) {
    return `## Extended Practice\n\n${input}`;
};

json2md.converters.manager = function (input) {
    return `## Manager\n\n${input}`;
};

json2md.converters.practice = function (input) {
    // return `## Practice\n\n${input}`;
    return ``;
};

json2md.converters.title = function (input) {
    return `## Title\n\n${input}`;
};

json2md.converters.projectId = function (input) {
    // return `## Title\n\n${input}`;

    return ``;
};

json2md.converters.isPublic = function (input) {
    // return `## Title\n\n${input}`;

    return ``;
};

json2md.converters.position = function (input) {
    // return `## Title\n\n${input}`;

    return ``;
};

module.exports = { json2md };
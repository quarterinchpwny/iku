import { ActivityRecognition } from 'qipz-activity';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    ActivityRecognition.echo({ value: inputValue })
}

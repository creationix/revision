
import { ProgressTest } from "./components/progress-test";
import { projector } from "./libs/maquette";

projector.append(document.body, ProgressTest().render);

from traitlets import Dict, List, Integer
from traitlets.config.configurable import Configurable


class JupyterlabLocalBrowser(Configurable):

    persistent = List(default=[], config=True)
    hidden = List(default=[], config=True)
    labels = Dict({}, config=True)

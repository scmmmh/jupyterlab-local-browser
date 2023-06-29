try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'jupyterlab_local_browser' outside a proper installation.")
    __version__ = "dev"
from .handlers import setup_handlers
from .config import JupyterlabLocalBrowser as JupyterlabLocalBrowserConfig


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "local_browser"
    }]


def _jupyter_server_extension_points():
    """Specify which module contains the server extension."""
    return [{'module': 'jupyterlab_local_browser'}]


def _load_jupyter_server_extension(server_app):
    """Setup the server extension."""
    setup_handlers(server_app.web_app, JupyterlabLocalBrowserConfig(parent=server_app))

import React, { useEffect, useRef, useState, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../ActivityLevels.less';
import { importWorkspace, exportWorkspace, compileArduinoCode, handleUpdateWorkspace,  handleCreatorSaveActivityLevel, handleCreatorSaveActivity } from '../../Utils/helpers';
import { message, Spin, Row, Col, Alert, Menu, Dropdown } from 'antd';
import CodeModal from '../modals/CodeModal';
import ConsoleModal from '../modals/ConsoleModal';
import PlotterModal from '../modals/PlotterModal';
import LoadWorkspaceModal from '../modals/LoadWorkspaceModal';
import SaveAsModal from '../modals/SaveAsModal';
import DisplayDiagramModal from '../modals/DisplayDiagramModal'
import StudentToolboxMenu from '../modals/StudentToolboxMenu';
import {
  connectToPort,
  handleCloseConnection,
  handleOpenConnection,
} from '../../Utils/consoleHelpers';
import { getAuthorizedWorkspace,  getAuthorizedWorkspaceToolbox, getAuthorizedWorkspaces } from '../../../../Utils/requests';
import ArduinoLogo from '../Icons/ArduinoLogo';
import PlotterLogo from '../Icons/PlotterLogo';

let plotId = 1;

export default function MentorCanvas({ activity, isSandbox, setActivity,  isMentorActivity }) {
  const [hoverUndo, setHoverUndo] = useState(false);
  const [hoverRedo, setHoverRedo] = useState(false);
  const [hoverCompile, setHoverCompile] = useState(false);
  const [hoverConsole, setHoverConsole] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showPlotter, setShowPlotter] = useState(false);
  const [plotData, setPlotData] = useState([]);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [selectedCompile, setSelectedCompile] = useState(false);
  const [compileError, setCompileError] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [studentToolbox, setStudentToolbox] = useState([]);
  const [openedToolBoxCategories, setOpenedToolBoxCategories] = useState([]);
  const [forceUpdate] = useReducer((x) => x + 1, 0);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [lastAutoSave, setLastAutoSave] = useState(null);
  const workspaceRef = useRef(null);
  const activityRef = useRef(null);
  const navigate = useNavigate();

  const setWorkspace = () => {
    workspaceRef.current = window.Blockly.inject('blockly-canvas', {
      toolbox: document.getElementById('toolbox'),
    });
    window.Blockly.addChangeListener(blocklyEvent);
  };

  useEffect(() => {
    // once the activity state is set, set the workspace and save
    const setUp = async () => {
      const classroom = sessionStorage.getItem('classroomId');
      setClassroomId(classroom);
      activityRef.current = activity;
      if (!workspaceRef.current && activity && Object.keys(activity).length !== 0) {
        setWorkspace();
        // if (activity.template) {
        //   let xml = window.Blockly.Xml.textToDom(activity.template);
        //   window.Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
        // }
        let xml = isMentorActivity
        ? window.Blockly.Xml.textToDom(activity.activity_template)
        : window.Blockly.Xml.textToDom(activity.template);
      window.Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
        workspaceRef.current.clearUndo();
      }
    };
    setUp();
  }, [activity]);

  const loadSave = async (workspaceId) => {
    // get the corresponding workspace
    const res = await getAuthorizedWorkspace(workspaceId);
    if (res.data) {
      // set up the canvas
      if (workspaceRef.current) workspaceRef.current.clear();
      let xml = window.Blockly.Xml.textToDom(res.data.template);
      window.Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
      setActivity(res.data);
    } else {
      message.error(res.err);
      return false;
    }

    if (!isSandbox) {
      const toolboxRes = await getAuthorizedWorkspaceToolbox(workspaceId);
      if (toolboxRes.data) {
        let tempCategories = [],
          tempToolBox = [];
        toolboxRes.data.toolbox &&
          toolboxRes.data.toolbox.forEach(([category, blocks]) => {
            tempCategories.push(category);
            tempToolBox = [
              ...tempToolBox,
              ...blocks.map((block) => block.name),
            ];
          });

        setOpenedToolBoxCategories(tempCategories);
        setStudentToolbox(tempToolBox);
      }
    }
  };

   let blocked = false;
  const blocklyEvent = (event) => {
    // if it is a click event, add click
    if (
      (event.type === 'ui' && event.element === 'click') ||
      event.element === 'selected'
    ) {
      handleCreatorAutosave();
      clicks.current++;
    }

    // if it is other ui events or create events or is [undo, redo], return
    if (event.type === 'ui' || !event.recordUndo) {
      return;
    }

    // if event is in timeout, return
    if (event.type === 'change' && blocked) {
      return;
    }

    // if the event is change field value, only accept the latest change
    if (
      event.type === 'change' &&
      event.element === 'field' &&
      replayRef.current.length > 1 &&
      replayRef.current[replayRef.current.length - 1].action ===
        'change field' &&
      replayRef.current[replayRef.current.length - 1].blockId === event.blockId
    ) {
      replayRef.current.pop();
    }

    // event delete always comes after a move, ignore the move
    if (event.type === 'delete') {
      if (replayRef.current[replayRef.current.length - 1].action === 'move') {
        replayRef.current.pop();
      }
    }

    // if event is change, add the detail action type
    if (event.type === 'change' && event.element) {
      pushEvent(`${event.type} ${event.element}`, event.blockId);
    } else {
      pushEvent(event.type, event.blockId);
    }

    // timeout for half a second
    blocked = true;
    setTimeout(() => {
      blocked = false;
    }, 500);
  };

  const handleUndo = () => {
    if (workspaceRef.current.undoStack_.length > 0)
      workspaceRef.current.undo(false);
  };

  const handleRedo = () => {
    if (workspaceRef.current.redoStack_.length > 0)
      workspaceRef.current.undo(true);
  };

  const handleConsole = async () => {
    if (showPlotter) {
      message.warning('Close serial plotter before openning serial monitor');
      return;
    }
    // if serial monitor is not shown
    if (!showConsole) {
      // connect to port
      await handleOpenConnection(9600, 'newLine');
      // if fail to connect to port, return
      if (typeof window['port'] === 'undefined') {
        message.error('Fail to select serial device');
        return;
      }
      setConnectionOpen(true);
      setShowConsole(true);
    }
    // if serial monitor is shown, close the connection
    else {
      if (connectionOpen) {
        await handleCloseConnection();
        setConnectionOpen(false);
      }
      setShowConsole(false);
    }
  };

  const handlePlotter = async () => {
    if (showConsole) {
      message.warning('Close serial monitor before openning serial plotter');
      return;
    }

    if (!showPlotter) {
      await handleOpenConnection(
        9600,
        'plot',
        plotData,
        setPlotData,
        plotId,
        forceUpdate
      );
      if (typeof window['port'] === 'undefined') {
        message.error('Fail to select serial device');
        return;
      }
      setConnectionOpen(true);
      setShowPlotter(true);
    } else {
      plotId = 1;
      if (connectionOpen) {
        await handleCloseConnection();
        setConnectionOpen(false);
      }
      setShowPlotter(false);
    }
  };

  const handleCompile = async () => {
    if (showConsole || showPlotter) {
      message.warning(
        'Close Serial Monitor and Serial Plotter before uploading your code'
      );
    } else {
      if (typeof window['port'] === 'undefined') {
        await connectToPort();
      }
      if (typeof window['port'] === 'undefined') {
        message.error('Fail to select serial device');
        return;
      }
      setCompileError('');
      await compileArduinoCode(
        workspaceRef.current,
        setSelectedCompile,
        setCompileError,
        activity,
        false
      );
    }
  };

  const handleGoBack = () => {
    if (
      window.confirm(
        'All unsaved progress will be lost. Do you still want to go back?'
      )
    )
      navigate(-1);
  };
  const handleCreatorAutosave = async () => {
    const res = await handleCreatorSave();
    if (res.err){
      message.error(res.err);
    }
  };
  const handleCreatorSave = async () => {
    // Save activity template
    if (!isSandbox && !isMentorActivity) {
      const res = await handleCreatorSaveActivityLevel(
        activity.id,
        workspaceRef,
        studentToolbox
      );
      if (res.err) {
        message.error(res.err);
      } else {
        message.success('Activity Template saved successfully');
        setLastSavedTime(Date().toLocaleTimeString());
      }
    } else if (!isSandbox && isMentorActivity) {
      // Save activity template
      const res = await handleCreatorSaveActivity(activity.id, workspaceRef);
      if (res.err) {
        message.error(res.err);
      } else {
        message.success('Activity template saved successfully');
        setLastSavedTime(Date().toLocaleTimeString());

      }
    } else {
      // if we already have the workspace in the db, just update it.
      if (activity && activity.id) {
        const updateRes = await handleSave(activity.id, workspaceRef, replayRef.current);

        if (updateRes.err) {
          message.error(updateRes.err);
        } else {
          message.success('Workspace saved successfully');
          setLastSavedTime(getFormattedDate(res.data[0].updated_at));
        }
      }
      // else create a new workspace and update local storage
      else {
        setShowSaveAsModal(true);
      }
    }
    const savesRes = await getAuthorizedWorkspace(activity.id);
    if (savesRes.data) setSaves(savesRes.data);
    };
  const menu = (
    <Menu>
      <Menu.Item onClick={handlePlotter}>
        <PlotterLogo />
        &nbsp; Show Serial Plotter
      </Menu.Item>
      <CodeModal title={'XML'} workspaceRef={workspaceRef.current} />
      <Menu.Item>
        <CodeModal title={'Arduino Code'} workspaceRef={workspaceRef.current} />
      </Menu.Item>
    </Menu>
  );

  const menuSave = (
    <Menu>
      <Menu.Item id='menu-save' onClick={handleCreatorSave} key='test'>
        <i className='fa fa-save'/>
        &nbsp; Save to template
      </Menu.Item>
      <SaveAsModal
        visible={showSaveAsModal}
        setVisible={setShowSaveAsModal}
        workspaceRef={workspaceRef}
        activity={activity}
        setActivity={setActivity}
        isSandbox={isSandbox}
        classroomId={classroomId}
      />
      <LoadWorkspaceModal loadSave={loadSave} classroomId={classroomId} />
    </Menu>
  );
  
  let alreadyImportedFromCookie = false;
  const handleImportFromCookie = () => {
    let workspaceXmlCached = sessionStorage.getItem("casmm-workspace-login");
    if (workspaceXmlCached === null || workspaceXmlCached === "" || alreadyImportedFromCookie) {
      return;
    }
    if (window.Blockly.mainWorkspace !== null) {
      // alert(workspaceXmlCached);
      importWorkspace(window.Blockly.mainWorkspace, workspaceXmlCached);
      alreadyImportedFromCookie = true;  // Only import once
      window.sessionStorage.removeItem("casmm-workspace-login");
    }
    else {
      // Keep trying to import every few seconds until we succeed.
      setTimeout(handleImportFromCookie, 3000);
    }
  }
  setTimeout(handleImportFromCookie, 3000);
  
  return (
    <div id='horizontal-container' className='flex flex-column'>
      <div className='flex flex-row'>
        <div
          id='bottom-container'
          className='flex flex-column vertical-container overflow-visible'
        >
          <Spin
            tip='Compiling Code Please Wait... It may take up to 20 seconds to compile your code.'
            className='compilePop'
            size='large'
            spinning={selectedCompile}
          >
            <Row id='icon-control-panel'>
              <Col flex='none' id='section-header'>
                {activity.lesson_module_name
                  ? `${activity.lesson_module_name} - Activity ${activity.number}`
                  : activity.name
                  ? `Workspace: ${activity.name}`
                  : 'New Workspace!'}
              </Col>
              <Col flex='auto'>
                <Row align='middle' justify='end' id='description-container'>
                  <Col flex={'30px'}>
                    <button
                      onClick={handleGoBack}
                      id='link'
                      className='flex flex-column'
                    >
                      <i id='icon-btn' className='fa fa-arrow-left' />
                    </button>
                  </Col>
                  <Col flex='auto' />
                  <Row id='right-icon-container'>
                    {!isSandbox ? (
                      <Col
                        className='flex flex-row'
                        id='save-dropdown-container'
                      >
                        <Dropdown overlay={menuSave}>
                          <i id='icon-btn' className='fa fa-save' />
                        </Dropdown>
                        <i className='fas fa-angle-down' id='caret'></i>
                      </Col>
                    ) : null}
                    <Col className='flex flex-row' id='redo-undo-container'>
                      <button
                        onClick={handleUndo}
                        id='link'
                        className='flex flex-column'
                      >
                        <i
                          id='icon-btn'
                          className='fa fa-undo-alt'
                          style={
                            workspaceRef.current
                              ? workspaceRef.current.undoStack_.length < 1
                                ? { color: 'grey', cursor: 'default' }
                                : null
                              : null
                          }
                          onMouseEnter={() => setHoverUndo(true)}
                          onMouseLeave={() => setHoverUndo(false)}
                        />
                        {hoverUndo && (
                          <div className='popup ModalCompile4'>Undo</div>
                        )}
                      </button>
                      <button
                        onClick={handleRedo}
                        id='link'
                        className='flex flex-column'
                      >
                        <i
                          id='icon-btn'
                          className='fa fa-redo-alt'
                          style={
                            workspaceRef.current
                              ? workspaceRef.current.redoStack_.length < 1
                                ? { color: 'grey', cursor: 'default' }
                                : null
                              : null
                          }
                          onMouseEnter={() => setHoverRedo(true)}
                          onMouseLeave={() => setHoverRedo(false)}
                        />
                        {hoverRedo && (
                          <div className='popup ModalCompile4'>Redo</div>
                        )}
                      </button>
                    </Col>
                    <Col className='flex flex-row'>
                      <div
                        id='action-btn-container'
                        className='flex space-around'
                      >
                        <ArduinoLogo
                          setHoverCompile={setHoverCompile}
                          handleCompile={handleCompile}
                        />
                        {hoverCompile && (
                          <div className='popup ModalCompile'>
                            Upload to Arduino
                          </div>
                        )}
                    <DisplayDiagramModal
                      image={activity.images}
                    />
                        <i
                          onClick={() => handleConsole()}
                          className='fas fa-terminal hvr-info'
                          style={{ marginLeft: '6px' }}
                          onMouseEnter={() => setHoverConsole(true)}
                          onMouseLeave={() => setHoverConsole(false)}
                        />
                        {hoverConsole && (
                          <div className='popup ModalCompile'>
                            Show Serial Monitor
                          </div>
                        )}
                        <Dropdown overlay={menu}>
                          <i className='fas fa-ellipsis-v'></i>
                        </Dropdown>
                      </div>
                    </Col>
                  </Row>
                </Row>
              </Col>
            </Row>
            <div id='blockly-canvas' />
          </Spin>
          </div>
           {!isSandbox && !isMentorActivity && (
          <StudentToolboxMenu
            activity={activity}
            studentToolbox={studentToolbox}
            setStudentToolbox={setStudentToolbox}
            openedToolBoxCategories={openedToolBoxCategories}
            setOpenedToolBoxCategories={setOpenedToolBoxCategories}
          />
          )}
        <ConsoleModal
          show={showConsole}
          connectionOpen={connectionOpen}
          setConnectionOpen={setConnectionOpen}
        ></ConsoleModal>
        <PlotterModal
          show={showPlotter}
          connectionOpen={connectionOpen}
          setConnectionOpen={setConnectionOpen}
          plotData={plotData}
          setPlotData={setPlotData}
          plotId={plotId}
        />
      </div>

      {/* This xml is for the blocks' menu we will provide. Here are examples on how to include categories and subcategories */}
      <xml id='toolbox' is='Blockly workspace'>
        {
          // Maps out block categories
          activity &&
            activity.toolbox &&
            activity.toolbox.map(([category, blocks]) => (
              <category name={category} is='Blockly category' key={category}>
                {
                  // maps out blocks in category
                  // eslint-disable-next-line
                  blocks.map((block) => {
                    return (
                      <block
                        type={block.name}
                        is='Blockly block'
                        key={block.name}
                      />
                    );
                  })
                }
              </category>
            ))
        }
      </xml>

      {compileError && (
        <Alert
          message={compileError}
          type='error'
          closable
          onClose={(e) => setCompileError('')}
        ></Alert>
      )}
    </div>
  );
}

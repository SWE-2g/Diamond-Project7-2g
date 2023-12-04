import { Modal, Button, Typography, Menu } from 'antd';
import '../modals/App.css'
import React, { useEffect, useRef, useState, useReducer } from 'react';
import { getArduino, getXml, compileArduinoCode, handleSave, importWorkspace, exportWorkspace} from '../../Utils/helpers';
import LoadWorkspaceModal from '../modals/LoadWorkspaceModal'



export default function ImportTemplateModal(props) {
  const [visible, setVisible] = useState(false);
  const {title, template1, template2, workspaceRef} = props;
  const { Text } = Typography;

   // LEP 12/03/2023
  var template = template1;
  
  const showModal = () => {
    setVisible(true);
  };

  const handleCancel = () => {
    setVisible(false);
  };

  const handleSelect = (p) => {
    return(template = p);
    //handleImport();
  } 

  // LEP 11/27/2023

  const handleImport = () => {
    window.Blockly.mainWorkspace.clear();
    var message = "Would you like to Import the following code:\n\n" + template;
    if(window.confirm(message)){
      importWorkspace(window.Blockly.mainWorkspace, template);
      forceUpdate.x;
    }
    setVisible(false);
  };
  

  return (
    <div>
      <Menu.Item onClick={showModal}>
          &nbsp;Import Template
        </Menu.Item>
      <Modal
        title={title}
        visible={visible}
        onCancel={handleCancel}
        onOk={handleCancel}
        width='50vw'
        footer={[
          <Button key='Import' type='primary' onClick={handleImport}>
            Import
          </Button>, 
        ]} 
      >
        <section className='templateItem' onClick={handleSelect(template1)}>
          <div>
            <h1>Template 1:</h1>
            <p1>{template1}</p1>
            {/* <div><Button key='Import' type='primary' onClick={handleImport}>Import</Button></div> */}
          </div>
        </section>
        <section className='templateItem' onClick={handleSelect(template2)}> 
          <div>
            <h1>Template 2:</h1> 
            <p1>{template2}</p1>
            {/* <div><Button key='Import' type='primary' onClick={handleImport}>Import</Button></div> */}
          </div>
        </section>
      </Modal>
    </div>
  );
}

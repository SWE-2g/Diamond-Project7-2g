import { Modal, Button, Typography, Menu } from 'antd';
import React, { useState } from 'react';
import { getArduino, getXml } from '../../Utils/helpers';
import LoadWorkspaceModal from '../modals/LoadWorkspaceModal'

export const [template, setTemplate] = useState('<xml xmlns="http://www.w3.org/1999/xhtml"><block type="insert_comment" id="e+=AbFk34=s=vI~Ft[2F" x="198" y="8"><mutation items="1"></mutation></block><block type="controls_if" id="3LG7v[2hd5,OB|)!_C0y" x="218" y="42"></block></xml>');

export function ImportTemplateModal(props) {
  const [visible, setVisible] = useState(false);
  const { title, workspaceRef } = props;
  const { Text } = Typography;

  const showModal = () => {
    setVisible(true);
  };

  const handleCancel = () => {
    setVisible(false);
  };

 // LEP 11/27/2023

 const handleImport = () => {
   window.Blockly.mainWorkspace.clear();
   importWorkspace(window.Blockly.mainWorkspace, template);
   forceUpdate.x;
 }


  return (
    <div>
      <Menu.Item onClick={showModal}>
          &nbsp;Import Template
        </Menu.Item>
      <Modal
        title={title}
        visible={visible}
        onCancel={handleCancel}
        width='50vw'
        footer={[
          <Button key='Import' type='primary' onClick={handleImport}>
            Import
          </Button>,
        ]}
      >
      </Modal>
    </div>
  );
}

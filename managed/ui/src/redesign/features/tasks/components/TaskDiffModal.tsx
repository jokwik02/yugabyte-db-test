/*
 * Created on Wed May 15 2024
 *
 * Copyright 2021 YugaByte, Inc. and Contributors
 * Licensed under the Polyform Free Trial License 1.0.0 (the "License")
 * You may not use this file except in compliance with the License. You may obtain a copy of the License at
 * http://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import { toast } from 'react-toastify';
import { YBModal } from '../../../components';
import { YBLoadingCircleIcon } from '../../../../components/common/indicators';
import { BaseDiff } from './diffComp/diffs/BaseDiff';
import GFlagsDiff from './diffComp/diffs/GFlagsDiff';
import SoftwareUpgradeDiff from './diffComp/diffs/SoftwareUpgradeDiff';
import UniverseDiff from './diffComp/diffs/UniverseDiff';
import { fetchRootSubTaskDetails, getAuditLog } from './diffComp/api';
import { mapAuditLogToTaskDiffApiResp } from '../TaskUtils';
import { TargetType, Task, TaskType } from '../dtos';
import { DiffComponentProps } from './diffComp/dtos';

interface TaskDiffModalProps {
  visible: boolean;
  onClose: () => void;
  currentTask: Task | null;
}

const TaskDiffModal: React.FC<TaskDiffModalProps> = ({ visible, onClose, currentTask }) => {
  const { t } = useTranslation('translation', {
    keyPrefix: 'taskDetails.diffModal'
  });

  // Differ to be used for the current task.
  const [differ, setDiffer] = useState<BaseDiff<DiffComponentProps, any> | null>(null);
  // we need to check if this task is a retried tasks
  // if it is, we need to get the previous task details
  const { data: taskDetails, isSuccess, isLoading: isSubTaskDetailsLoading } = useQuery(
    ['subTasks-parent', currentTask!.id!],
    () => fetchRootSubTaskDetails(currentTask!.id!, currentTask!.targetUUID),
    {
      select: (data) => data,
      enabled: !!currentTask && visible
    }
  );

  const { data: auditData, isLoading: isAuditQueryLoading } = useQuery(
    ['auditData', currentTask?.id, isSuccess],
    // if it is a retried task, get the parent task uuid and get it's Audit log
    () =>
      getAuditLog(
        (taskDetails && taskDetails[currentTask!.targetUUID!]?.[0]?.id) ?? currentTask!.id!
      ),
    {
      enabled: !!currentTask && visible && isSuccess,
      select: (data) => data.data,
      onError: () => {
        toast.error(t('diffDetailsNotFound'));
      }
    }
  );

  const taskDiffDetails = useMemo(() => mapAuditLogToTaskDiffApiResp(auditData), [auditData]);

  useEffect(() => {
    if (!currentTask || !visible || !taskDiffDetails) {
      return;
    }

    // Set the differ based on the task type.

    if (
      (currentTask.target === TargetType.UNIVERSE && currentTask.type === TaskType.EDIT) ||
      (currentTask.target === TargetType.UNIVERSE && currentTask.type === TaskType.RESIZE_NODE)
    ) {
      setDiffer(new UniverseDiff({ ...taskDiffDetails, task: currentTask }));
    }
    if (
      currentTask.target === TargetType.UNIVERSE &&
      currentTask.type === TaskType.GFlags_UPGRADE
    ) {
      setDiffer(new GFlagsDiff({ ...taskDiffDetails, task: currentTask }));
    }
    if (
      currentTask.target === TargetType.UNIVERSE &&
      currentTask.type === TaskType.SOFTWARE_UPGRADE
    ) {
      setDiffer(new SoftwareUpgradeDiff({ ...taskDiffDetails, task: currentTask }));
    }
  }, [currentTask, visible, taskDiffDetails]);

  // Get the diff component to be rendered.
  // memoize to avoid re-rendering on every state change.
  const diffComponents = useMemo(() => {
    if (!differ || !visible) {
      return null;
    }
    return differ.getDiffComponent();
  }, [differ, visible]);

  if (!currentTask || !visible) {
    return null;
  }

  if (isSubTaskDetailsLoading || isAuditQueryLoading) {
    return (
      <div style={{ position: 'absolute', top: '30%', left: '50%' }}>
        <YBLoadingCircleIcon />
      </div>
    );
  }

  if (!taskDiffDetails) {
    return null;
  }

  return (
    <YBModal
      open={visible}
      onClose={onClose}
      title={t(`${currentTask?.type}`, { keyPrefix: 'taskDetails.diffModal.titles' })}
      overrideWidth={'900px'}
      overrideHeight={'auto'}
      titleSeparator
      enableBackdropDismiss
      dialogContentProps={{ dividers: true, style: { padding: '20px' } }}
    >
      {diffComponents}
    </YBModal>
  );
};

export default TaskDiffModal;

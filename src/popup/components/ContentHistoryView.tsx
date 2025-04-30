import React, { useState } from 'react';
import { BaseMonitoringItem, ContentHistoryEntry } from '../../types/monitoringTypes';
import { Card, Typography, List, Button, Divider, Tag, Space, Timeline } from 'antd';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

const HistoryCard = styled(Card)`
  margin-bottom: 16px;
`;

const DiffHighlight = styled.div`
  padding: 8px;
  margin-top: 8px;
  border-radius: 4px;
  
  &.added {
    background-color: #f6ffed;
    border: 1px solid #b7eb8f;
  }
  
  &.removed {
    background-color: #fff2f0;
    border: 1px solid #ffccc7;
  }
`;

const ScrollableContent = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #eee;
  padding: 8px;
  margin: 8px 0;
  border-radius: 4px;
  background-color: #fafafa;
`;

interface ContentHistoryViewProps {
  item: BaseMonitoringItem;
}

const ContentHistoryView: React.FC<ContentHistoryViewProps> = ({ item }) => {
  const [selectedVersion, setSelectedVersion] = useState<ContentHistoryEntry | null>(null);
  
  if (!item.contentHistory || item.contentHistory.length === 0) {
    return (
      <Card>
        <Paragraph>No content history available yet. Changes will be recorded when detected.</Paragraph>
      </Card>
    );
  }
  
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const renderDiffHighlights = () => {
    if (!item.lastDiff) return null;
    
    return (
      <>
        <Divider orientation="left">Last detected changes</Divider>
        {item.lastDiff.added.length > 0 && (
          <DiffHighlight className="added">
            <Text strong>Added content:</Text>
            {item.lastDiff.added.map((line, index) => (
              <div key={`added-${index}`}>+ {line}</div>
            ))}
          </DiffHighlight>
        )}
        
        {item.lastDiff.removed.length > 0 && (
          <DiffHighlight className="removed">
            <Text strong>Removed content:</Text>
            {item.lastDiff.removed.map((line, index) => (
              <div key={`removed-${index}`}>- {line}</div>
            ))}
          </DiffHighlight>
        )}
      </>
    );
  };
  
  const renderHistoryContent = () => {
    if (selectedVersion) {
      return (
        <Card title={`Content from ${formatDate(selectedVersion.timestamp)}`}>
          <ScrollableContent>
            <pre>{selectedVersion.content}</pre>
          </ScrollableContent>
          <Button onClick={() => setSelectedVersion(null)}>Back to history</Button>
        </Card>
      );
    }
    
    return (
      <Timeline
        mode="left"
        items={item.contentHistory.map((entry, index) => ({
          children: (
            <Space direction="vertical">
              <Text>{formatDate(entry.timestamp)}</Text>
              <Button size="small" onClick={() => setSelectedVersion(entry)}>
                View content
              </Button>
            </Space>
          ),
          color: index === item.contentHistory.length - 1 ? 'green' : 'blue',
        }))}
      />
    );
  };
  
  return (
    <HistoryCard title="Content History">
      {renderDiffHighlights()}
      <Divider orientation="left">Version History</Divider>
      {renderHistoryContent()}
    </HistoryCard>
  );
};

export default ContentHistoryView; 